'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Bot,
  CornerUpLeft,
  FileText,
  Paperclip,
  Pencil,
  SendHorizontal,
  SmilePlus,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';
import { Spinner } from './Feedback';
import {
  activeMentionQuery,
  commentDraftFromBody,
  commentPlainText,
  parseCommentBody,
  serializeCommentDraft,
  type CommentMention,
} from './commentText';

export type CommentAuthorKind = 'user' | 'agent' | 'system';
export type CommentStatus = 'pending' | 'streaming' | 'sent' | 'failed';
export type CommentFollowState = 'none' | 'following' | 'muted';

export interface CommentAuthor {
  kind: CommentAuthorKind;
  userId: string | null;
  agentId?: string | null;
  handle?: string | null;
  name: string;
  avatarUrl?: string | null;
}

export interface CommentAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
}

export interface CommentReaction {
  emoji: string;
  count: number;
  mine: boolean;
  names: string[];
}

export interface CommentReplyRef {
  id: string;
  authorName: string;
  excerpt: string;
  hasAttachments: boolean;
  deleted: boolean;
}

export interface CommentMessage {
  id: string;
  author: CommentAuthor;
  /** Plain text with `<@u:UUID>` / `<@a:handle>` mention tokens. */
  body: string;
  status: CommentStatus;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  replyTo: CommentReplyRef | null;
  mentions: CommentMention[];
  attachments: CommentAttachment[];
  reactions: CommentReaction[];
}

export interface CommentMentionCandidate extends CommentMention {
  email?: string | null;
  avatarUrl?: string | null;
  description?: string | null;
}

export interface CommentDraft {
  body: string;
  replyTo: string | null;
  attachmentIds: string[];
}

export interface CommentThreadProps {
  /** Chronological, oldest first. */
  messages: readonly CommentMessage[];
  viewerId: string | null;
  canWrite: boolean;
  /** First load in flight: the list shows a spinner instead of the empty state. */
  loading?: boolean;
  /** A load or refresh error to show above the composer. */
  error?: string | null;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  /** Messages after this instant (not the viewer's) are marked "Nuevos". */
  lastReadAt?: string | null;
  follow?: CommentFollowState;
  onFollowChange?: (follow: CommentFollowState) => void;
  /** URL the app serves an attachment from (its own proxy, never the bucket). */
  attachmentHref: (attachmentId: string, options?: { download?: boolean }) => string;
  onSend: (draft: CommentDraft) => Promise<void>;
  onEdit?: (messageId: string, body: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onReact?: (messageId: string, emoji: string, on: boolean) => void | Promise<void>;
  /** People (and agents) the viewer can tag, for the typed `@query`. */
  onSearchMentions?: (query: string) => Promise<CommentMentionCandidate[]>;
  /** Uploads one file and returns it as a loose attachment. Omit to hide the clip. */
  onUpload?: (file: File) => Promise<CommentAttachment>;
  title?: ReactNode;
  emptyText?: string;
  placeholder?: string;
  className?: string;
}

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '✅', '👀', '🔥'];
const MAX_FILES = 10;

const timeFormat = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Hoy';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Ayer';
  const label = dayFormat.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const isInlineImage = (mime: string) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime);

function MessageBody({ message }: { message: CommentMessage }) {
  const segments = useMemo(() => parseCommentBody(message.body, message.mentions), [message.body, message.mentions]);
  return (
    <p className="pr-comments__text">
      {segments.map((s, i) =>
        s.type === 'text' ? (
          <Fragment key={i}>{s.text}</Fragment>
        ) : (
          <span key={i} className={cx('pr-comments__mention', s.kind === 'agent' && 'pr-comments__mention--agent')}>
            @{s.name}
          </span>
        ),
      )}
    </p>
  );
}

function Attachments({
  attachments,
  attachmentHref,
}: {
  attachments: readonly CommentAttachment[];
  attachmentHref: CommentThreadProps['attachmentHref'];
}) {
  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => isInlineImage(a.mimeType));
  const files = attachments.filter((a) => !isInlineImage(a.mimeType));
  return (
    <div className="pr-comments__attachments">
      {images.length > 0 && (
        <div className="pr-comments__images">
          {images.map((a) => (
            <a key={a.id} href={attachmentHref(a.id)} target="_blank" rel="noreferrer" className="pr-comments__image">
              <img
                src={attachmentHref(a.id)}
                alt={a.fileName}
                loading="lazy"
                width={a.width ?? undefined}
                height={a.height ?? undefined}
              />
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a key={a.id} href={attachmentHref(a.id, { download: true })} className="pr-comments__file" download={a.fileName}>
          <FileText size={16} aria-hidden />
          <span className="pr-comments__file-name">{a.fileName}</span>
          <span className="pr-comments__file-size">{fileSize(a.sizeBytes)}</span>
        </a>
      ))}
    </div>
  );
}

interface RowProps {
  message: CommentMessage;
  own: boolean;
  canWrite: boolean;
  highlighted: boolean;
  attachmentHref: CommentThreadProps['attachmentHref'];
  onReply: (message: CommentMessage) => void;
  onJumpTo: (messageId: string) => void;
  onReact?: CommentThreadProps['onReact'];
  onEdit?: CommentThreadProps['onEdit'];
  onDelete?: CommentThreadProps['onDelete'];
}

function MessageRow({
  message,
  own,
  canWrite,
  highlighted,
  attachmentHref,
  onReply,
  onJumpTo,
  onReact,
  onEdit,
  onDelete,
}: RowProps) {
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<{ text: string; picked: CommentMention[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAgent = message.author.kind === 'agent';
  const writing = isAgent && (message.status === 'pending' || message.status === 'streaming');
  const canAct = canWrite && !message.deleted && message.status === 'sent';

  const saveEdit = async () => {
    if (!editing || !onEdit) return;
    setBusy(true);
    try {
      await onEdit(message.id, serializeCommentDraft(editing.text, editing.picked));
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete(message.id);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <li
      id={`pr-comment-${message.id}`}
      className={cx('pr-comments__row', own && 'pr-comments__row--own', highlighted && 'pr-comments__row--highlight')}
    >
      {!own && (
        <span className="pr-comments__avatar">
          {isAgent ? (
            <span className="pr-comments__agent-avatar" aria-hidden>
              <Bot size={16} />
            </span>
          ) : (
            <Avatar name={message.author.name} src={message.author.avatarUrl ?? undefined} size="sm" decorative />
          )}
        </span>
      )}
      <div className="pr-comments__bubble-wrap">
        <div className={cx('pr-comments__bubble', isAgent && 'pr-comments__bubble--agent')}>
          <div className="pr-comments__meta">
            {!own && <span className="pr-comments__author">{message.author.name}</span>}
            {isAgent && <span className="pr-comments__badge">IA</span>}
            <time className="pr-comments__time" dateTime={message.createdAt}>
              {timeFormat.format(new Date(message.createdAt))}
            </time>
            {message.editedAt && !message.deleted && <span className="pr-comments__edited">editado</span>}
          </div>

          {message.replyTo && (
            <button type="button" className="pr-comments__quote" onClick={() => onJumpTo(message.replyTo!.id)}>
              <span className="pr-comments__quote-author">{message.replyTo.authorName}</span>
              <span className="pr-comments__quote-text">
                {message.replyTo.deleted
                  ? 'Mensaje eliminado'
                  : message.replyTo.excerpt || (message.replyTo.hasAttachments ? 'Archivo' : '')}
              </span>
            </button>
          )}

          {message.deleted ? (
            <p className="pr-comments__text pr-comments__text--deleted">Mensaje eliminado</p>
          ) : editing ? (
            <div className="pr-comments__edit">
              <textarea
                className="pr-comments__edit-input"
                value={editing.text}
                aria-label="Editar mensaje"
                autoFocus
                rows={3}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditing(null);
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void saveEdit();
                  }
                }}
              />
              <div className="pr-comments__edit-actions">
                <button type="button" className="pr-comments__link" onClick={() => setEditing(null)} disabled={busy}>
                  Cancelar
                </button>
                <button type="button" className="pr-comments__link pr-comments__link--strong" onClick={saveEdit} disabled={busy}>
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.body && <MessageBody message={message} />}
              {writing && (
                <span className="pr-comments__typing" aria-label="Escribiendo">
                  <span />
                  <span />
                  <span />
                </span>
              )}
              {isAgent && message.status === 'failed' && (
                <p className="pr-comments__failed">No se pudo completar la respuesta.</p>
              )}
              <Attachments attachments={message.attachments} attachmentHref={attachmentHref} />
            </>
          )}
        </div>

        {!message.deleted && message.reactions.length > 0 && (
          <div className="pr-comments__reactions">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={cx('pr-comments__reaction', r.mine && 'pr-comments__reaction--mine')}
                aria-pressed={r.mine}
                title={r.names.join(', ')}
                disabled={!canWrite || !onReact}
                onClick={() => onReact?.(message.id, r.emoji, !r.mine)}
              >
                <span aria-hidden>{r.emoji}</span>
                <span className="pr-comments__reaction-count">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {confirmDelete && (
          <div className="pr-comments__confirm" role="group" aria-label="Confirmar borrado">
            <span>¿Borrar este mensaje?</span>
            <button type="button" className="pr-comments__link" onClick={() => setConfirmDelete(false)} disabled={busy}>
              No
            </button>
            <button type="button" className="pr-comments__link pr-comments__link--danger" onClick={remove} disabled={busy}>
              Sí, borrar
            </button>
          </div>
        )}

        {picker && (
          <div className="pr-comments__picker" role="group" aria-label="Reaccionar">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="pr-comments__picker-item"
                aria-label={`Reaccionar con ${emoji}`}
                onClick={() => {
                  const mine = message.reactions.find((r) => r.emoji === emoji)?.mine ?? false;
                  void onReact?.(message.id, emoji, !mine);
                  setPicker(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {canAct && !editing && (
        <div className="pr-comments__actions">
          <IconButton size="sm" compact variant="ghost" label="Responder" icon={<CornerUpLeft size={14} />} onClick={() => onReply(message)} />
          {onReact && (
            <IconButton
              size="sm"
              compact
              variant="ghost"
              label="Reaccionar"
              icon={<SmilePlus size={14} />}
              aria-expanded={picker}
              onClick={() => setPicker((v) => !v)}
            />
          )}
          {own && onEdit && message.author.kind === 'user' && (
            <IconButton
              size="sm"
              compact
              variant="ghost"
              label="Editar"
              icon={<Pencil size={14} />}
              onClick={() => setEditing(commentDraftFromBody(message.body, message.mentions))}
            />
          )}
          {own && onDelete && message.author.kind === 'user' && (
            <IconButton size="sm" compact variant="ghost" label="Borrar" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)} />
          )}
        </div>
      )}
    </li>
  );
}

interface PendingFile {
  localId: string;
  fileName: string;
  status: 'uploading' | 'done' | 'error';
  attachment?: CommentAttachment;
  error?: string;
}

interface ComposerProps {
  replyTo: CommentMessage | null;
  onCancelReply: () => void;
  onSend: CommentThreadProps['onSend'];
  onSearchMentions?: CommentThreadProps['onSearchMentions'];
  onUpload?: CommentThreadProps['onUpload'];
  placeholder: string;
  droppedFiles: File[];
  onDroppedFilesTaken: () => void;
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

function Composer({
  replyTo,
  onCancelReply,
  onSend,
  onSearchMentions,
  onUpload,
  placeholder,
  droppedFiles,
  onDroppedFilesTaken,
  inputRef,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<CommentMention[]>([]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [candidates, setCandidates] = useState<CommentMentionCandidate[]>([]);
  const [active, setActive] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const listId = useId();
  const seq = useRef(0);

  // Suggestions for the `@query` being typed, debounced; a stale answer is dropped.
  useEffect(() => {
    if (!mention || !onSearchMentions) {
      setCandidates([]);
      return;
    }
    const ticket = ++seq.current;
    const timer = setTimeout(() => {
      onSearchMentions(mention.query)
        .then((found) => {
          if (ticket === seq.current) {
            setCandidates(found.slice(0, 8));
            setActive(0);
          }
        })
        .catch(() => {
          if (ticket === seq.current) setCandidates([]);
        });
    }, 150);
    return () => clearTimeout(timer);
  }, [mention, onSearchMentions]);

  const addFiles = useCallback(
    (list: readonly File[]) => {
      if (!onUpload || list.length === 0) return;
      const room = MAX_FILES - files.length;
      for (const file of list.slice(0, Math.max(room, 0))) {
        const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setFiles((prev) => [...prev, { localId, fileName: file.name, status: 'uploading' }]);
        onUpload(file)
          .then((attachment) =>
            setFiles((prev) => prev.map((f) => (f.localId === localId ? { ...f, status: 'done', attachment } : f))),
          )
          .catch((err: unknown) =>
            setFiles((prev) =>
              prev.map((f) =>
                f.localId === localId
                  ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'No se pudo subir' }
                  : f,
              ),
            ),
          );
      }
    },
    [files.length, onUpload],
  );

  useEffect(() => {
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
      onDroppedFilesTaken();
    }
  }, [droppedFiles, addFiles, onDroppedFilesTaken]);

  // The textarea grows with its content up to a cap.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text, inputRef]);

  const updateText = (value: string, caret: number) => {
    setText(value);
    setSendError(null);
    setMention(onSearchMentions ? activeMentionQuery(value, caret) : null);
  };

  const choose = (candidate: CommentMentionCandidate) => {
    if (!mention) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const inserted = `@${candidate.name} `;
    const next = text.slice(0, mention.start) + inserted + text.slice(caret);
    setText(next);
    setPicked((prev) => [...prev, { kind: candidate.kind, id: candidate.id, name: candidate.name }]);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = mention.start + inserted.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const uploading = files.some((f) => f.status === 'uploading');
  const ready = files.filter((f) => f.status === 'done' && f.attachment);
  const canSend = !sending && !uploading && (text.trim().length > 0 || ready.length > 0);

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    try {
      await onSend({
        body: serializeCommentDraft(text.trim(), picked),
        replyTo: replyTo?.id ?? null,
        attachmentIds: ready.map((f) => f.attachment!.id),
      });
      setText('');
      setPicked([]);
      setFiles([]);
      onCancelReply();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (i + 1) % candidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const candidate = candidates[active];
        if (candidate) choose(candidate);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Escape' && replyTo) onCancelReply();
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length > 0 && onUpload) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  const showSuggestions = mention !== null && candidates.length > 0;

  return (
    <div className="pr-comments__composer">
      {replyTo && (
        <div className="pr-comments__replying">
          <div className="pr-comments__replying-text">
            <span className="pr-comments__quote-author">Respondiendo a {replyTo.author.name}</span>
            <span className="pr-comments__quote-text">
              {commentPlainText(replyTo.body, replyTo.mentions) || (replyTo.attachments.length > 0 ? 'Archivo' : '')}
            </span>
          </div>
          <IconButton size="sm" compact variant="ghost" label="Cancelar respuesta" icon={<X size={14} />} onClick={onCancelReply} />
        </div>
      )}

      {files.length > 0 && (
        <ul className="pr-comments__pending">
          {files.map((f) => (
            <li key={f.localId} className={cx('pr-comments__pending-file', f.status === 'error' && 'pr-comments__pending-file--error')}>
              {f.status === 'uploading' ? <Spinner size="sm" /> : <FileText size={14} aria-hidden />}
              <span className="pr-comments__file-name" title={f.error ?? f.fileName}>
                {f.status === 'error' ? `${f.fileName}: ${f.error}` : f.fileName}
              </span>
              <IconButton
                size="sm"
                compact
                variant="ghost"
                label={`Quitar ${f.fileName}`}
                icon={<X size={12} />}
                onClick={() => setFiles((prev) => prev.filter((p) => p.localId !== f.localId))}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="pr-comments__input-row">
        {onUpload && (
          <>
            <IconButton
              size="sm"
              variant="ghost"
              label="Adjuntar archivos"
              icon={<Paperclip size={16} />}
              disabled={files.length >= MAX_FILES}
              onClick={() => fileInput.current?.click()}
            />
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept="image/*,.pdf,.xlsx,.xls,.docx,.doc,.csv,.txt"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </>
        )}
        <div className="pr-comments__input-wrap">
          <textarea
            ref={inputRef}
            className="pr-comments__input"
            rows={1}
            value={text}
            placeholder={placeholder}
            aria-label="Escribe un comentario"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls={showSuggestions ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={showSuggestions ? `${listId}-${active}` : undefined}
            onChange={(e) => updateText(e.target.value, e.target.selectionStart)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => setTimeout(() => setMention(null), 150)}
          />
          {showSuggestions && (
            <ul id={listId} role="listbox" className="pr-comments__suggestions">
              {candidates.map((c, i) => (
                <li
                  key={`${c.kind}:${c.id}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={cx('pr-comments__suggestion', i === active && 'pr-comments__suggestion--active')}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(c);
                  }}
                >
                  {c.kind === 'agent' ? (
                    <span className="pr-comments__agent-avatar" aria-hidden>
                      <Bot size={14} />
                    </span>
                  ) : (
                    <Avatar name={c.name} src={c.avatarUrl ?? undefined} size="xs" decorative />
                  )}
                  <span className="pr-comments__suggestion-name">{c.name}</span>
                  <span className="pr-comments__suggestion-hint">{c.kind === 'agent' ? c.description ?? 'Agente IA' : c.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <IconButton
          size="sm"
          variant="primary"
          label="Enviar"
          icon={sending ? <Spinner size="sm" tone="inherit" /> : <SendHorizontal size={16} />}
          disabled={!canSend}
          onClick={send}
        />
      </div>
      {sendError && (
        <p className="pr-comments__error" role="alert">
          {sendError}
        </p>
      )}
    </div>
  );
}

const FOLLOW_LABEL: Record<CommentFollowState, string> = {
  none: 'Seguir',
  following: 'Siguiendo',
  muted: 'Silenciado',
};

/**
 * A chat-style comment thread: bubbles, quoted replies, reactions, files,
 * `@mentions` with suggestions and AI-agent messages that stream in.
 *
 * Controlled and transport-free: the app loads and refreshes `messages` and
 * passes callbacks that talk to its own API. Every file URL comes from
 * `attachmentHref`, so the app decides how files are served.
 */
export function CommentThread({
  messages,
  viewerId,
  canWrite,
  loading = false,
  error = null,
  hasMore = false,
  loadingOlder = false,
  onLoadOlder,
  lastReadAt = null,
  follow,
  onFollowChange,
  attachmentHref,
  onSend,
  onEdit,
  onDelete,
  onReact,
  onSearchMentions,
  onUpload,
  title = 'Comentarios',
  emptyText = 'Todavía no hay comentarios. Escribe el primero; con @ etiquetas a alguien.',
  placeholder = 'Escribe un comentario… usa @ para etiquetar',
  className,
}: CommentThreadProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [replyTo, setReplyTo] = useState<CommentMessage | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState<File[]>([]);
  const nearBottom = useRef(true);
  const lastId = messages[messages.length - 1]?.id;
  const firstId = messages[0]?.id;
  const prevFirst = useRef<string | undefined>(undefined);
  const prevHeight = useRef(0);

  // Stay pinned to the newest message unless the reader scrolled up; keep the
  // reading position when older messages are prepended.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (prevFirst.current && firstId !== prevFirst.current && prevHeight.current) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (nearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevFirst.current = firstId;
    prevHeight.current = el.scrollHeight;
  }, [firstId, lastId, messages]);

  const firstUnread = useMemo(() => {
    if (!lastReadAt) return null;
    return messages.find((m) => m.createdAt > lastReadAt && m.author.userId !== viewerId && !m.deleted)?.id ?? null;
    // Frozen while the thread is open, so the divider does not jump as it is marked read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastReadAt, firstId]);

  const jumpTo = (id: string) => {
    const target = document.getElementById(`pr-comment-${id}`);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlight(id);
    setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1600);
  };

  const reply = (message: CommentMessage) => {
    setReplyTo(message);
    inputRef.current?.focus();
  };

  const dropProps =
    canWrite && onUpload
      ? {
          onDragOver: (e: DragEvent) => {
            if (Array.from(e.dataTransfer.types).includes('Files')) {
              e.preventDefault();
              setDragging(true);
            }
          },
          onDragLeave: (e: DragEvent) => {
            if (e.currentTarget === e.target) setDragging(false);
          },
          onDrop: (e: DragEvent) => {
            e.preventDefault();
            setDragging(false);
            setDropped(Array.from(e.dataTransfer.files));
          },
        }
      : {};

  let lastDay = '';

  return (
    <section className={cx('pr-comments', dragging && 'pr-comments--dragging', className)} aria-label="Comentarios" {...dropProps}>
      <header className="pr-comments__header">
        <h3 className="pr-comments__title">{title}</h3>
        {onFollowChange && follow && (
          <div className="pr-comments__follow" role="group" aria-label="Avisos de esta conversación">
            {(['following', 'none', 'muted'] as const).map((state) => (
              <button
                key={state}
                type="button"
                className={cx('pr-comments__follow-option', follow === state && 'pr-comments__follow-option--active')}
                aria-pressed={follow === state}
                title={
                  state === 'following'
                    ? 'Te avisamos de cada mensaje nuevo'
                    : state === 'muted'
                      ? 'Sólo te avisamos si te etiquetan'
                      : 'Te avisamos si te etiquetan; al etiquetarte empiezas a seguirla'
                }
                onClick={() => follow !== state && onFollowChange(state)}
              >
                {state === 'following' ? <BellRing size={14} aria-hidden /> : state === 'muted' ? <BellOff size={14} aria-hidden /> : <Bell size={14} aria-hidden />}
                {FOLLOW_LABEL[state]}
              </button>
            ))}
          </div>
        )}
      </header>

      <div
        ref={listRef}
        className="pr-comments__list"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {hasMore && onLoadOlder && (
          <div className="pr-comments__older">
            <button type="button" className="pr-comments__link" onClick={onLoadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
            </button>
          </div>
        )}
        {loading && messages.length === 0 ? (
          <div className="pr-comments__empty">
            <Spinner size="md" />
          </div>
        ) : messages.length === 0 ? (
          <p className="pr-comments__empty">{emptyText}</p>
        ) : (
          <ul className="pr-comments__messages">
            {messages.map((m) => {
              const day = dayKey(m.createdAt);
              const showDay = day !== lastDay;
              lastDay = day;
              const own = m.author.kind === 'user' && viewerId !== null && m.author.userId === viewerId;
              return (
                <Fragment key={m.id}>
                  {showDay && (
                    <li className="pr-comments__day" aria-hidden>
                      <span>{dayLabel(m.createdAt)}</span>
                    </li>
                  )}
                  {m.id === firstUnread && (
                    <li className="pr-comments__unread">
                      <span>Nuevos</span>
                    </li>
                  )}
                  <MessageRow
                    message={m}
                    own={own}
                    canWrite={canWrite}
                    highlighted={highlight === m.id}
                    attachmentHref={attachmentHref}
                    onReply={reply}
                    onJumpTo={jumpTo}
                    onReact={onReact}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p className="pr-comments__error" role="alert">
          {error}
        </p>
      )}

      {canWrite ? (
        <Composer
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={onSend}
          onSearchMentions={onSearchMentions}
          onUpload={onUpload}
          placeholder={placeholder}
          droppedFiles={dropped}
          onDroppedFilesTaken={() => setDropped([])}
          inputRef={inputRef}
        />
      ) : (
        <p className="pr-comments__readonly">Puedes leer estos comentarios, pero no tienes permiso para escribir.</p>
      )}
    </section>
  );
}
