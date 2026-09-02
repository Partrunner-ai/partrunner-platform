/**
 * @partrunner-ai/ui — L1 primitives.
 *
 * Presentation only, built on the `@partrunner-ai/tokens` scale. Apps keep
 * ownership of routing (via `asChild`), data and state; the package owns how a
 * control looks and how its states behave across consuming applications.
 *
 * Styling ships as `styles/ui.css` — plain CSS over `--pr-*`, not Tailwind
 * utilities — so it works the same in the Tailwind v3 apps, the v4 apps, and an
 * app with no Tailwind. Import it alongside a theme:
 *
 *   import '@partrunner-ai/tokens/crystal.css';
 *   import '@partrunner-ai/ui/styles.css';
 */
export {
  Button,
  type ButtonIcon,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './Button';
export { Badge, type BadgeProps, type BadgeSize, type BadgeTone } from './Badge';
export {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type CardContentProps,
  type CardDescriptionProps,
  type CardHeaderProps,
  type CardPadding,
  type CardTone,
  type CardProps,
  type CardTitleProps,
} from './Card';
export { Dialog, type DialogProps, type DialogSize } from './Dialog';
export {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  type DialogCloseProps,
  type DialogContentProps,
  type DialogDescriptionProps,
  type DialogFooterProps,
  type DialogHeaderProps,
  type DialogPrimitiveSize,
  type DialogRootProps,
  type DialogTitleProps,
  type DialogTriggerProps,
} from './DialogPrimitives';
export {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
  type AlertDialogActionProps,
  type AlertDialogCancelProps,
  type AlertDialogContentProps,
  type AlertDialogDescriptionProps,
  type AlertDialogFooterProps,
  type AlertDialogHeaderProps,
  type AlertDialogMediaProps,
  type AlertDialogRootProps,
  type AlertDialogTitleProps,
  type AlertDialogTriggerProps,
} from './AlertDialog';
export {
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetRoot,
  SheetTitle,
  SheetTrigger,
  type SheetCloseProps,
  type SheetContentProps,
  type SheetDescriptionProps,
  type SheetFooterProps,
  type SheetHeaderProps,
  type SheetRootProps,
  type SheetSide,
  type SheetTitleProps,
  type SheetTriggerProps,
  type SheetWidth,
} from './Sheet';
export {
  DialogLayer,
  registerDialogLayerPortal,
  type DialogLayerAutoFocusEvent,
  type DialogLayerProps,
} from './DialogLayer';
export { Input, type InputProps, type InputSize } from './Input';
export {
  FileDropzone,
  type FileDropzoneProps,
  type FileDropzoneSelectionSource,
} from './FileDropzone';
export {
  FormField,
  Label,
  type FormFieldProps,
  type LabelProps,
} from './FormField';
export { Textarea, type TextareaProps, type TextareaSize } from './Textarea';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { Switch, type SwitchProps } from './Switch';
export {
  CheckboxGroup,
  RadioGroup,
  type CheckboxGroupProps,
  type ChoiceGroupOrientation,
  type ChoiceOption,
  type RadioGroupProps,
} from './ChoiceGroup';
export {
  ValidationSummary,
  type ValidationSummaryError,
  type ValidationSummaryProps,
} from './ValidationSummary';
export {
  EmptyState,
  Spinner,
  type EmptyStateProps,
  type SpinnerProps,
  type SpinnerSize,
} from './Feedback';
export {
  MultiSelect,
  type MultiSelectOption,
  type MultiSelectProps,
  type MultiSelectVariant,
} from './MultiSelect';
export { Combobox, type ComboboxOption, type ComboboxProps } from './Combobox';
export {
  Select,
  type SelectOption,
  type SelectProps,
  type SelectSize,
} from './Select';
export {
  RichSelect,
  RichSelectContent,
  RichSelectEmpty,
  RichSelectGroup,
  RichSelectItem,
  RichSelectLabel,
  RichSelectSearch,
  RichSelectSeparator,
  RichSelectTrigger,
  RichSelectValue,
  type RichSelectContentProps,
  type RichSelectEmptyProps,
  type RichSelectGroupProps,
  type RichSelectItemProps,
  type RichSelectLabelProps,
  type RichSelectProps,
  type RichSelectSearchProps,
  type RichSelectSeparatorProps,
  type RichSelectSize,
  type RichSelectTriggerProps,
  type RichSelectValueProps,
} from './RichSelect';
export {
  Calendar,
  formatCalendarDate,
  isCalendarDate,
  parseCalendarDate,
  serializeCalendarDate,
  type CalendarDate,
  type CalendarDisabledDates,
  type CalendarProps,
  type CalendarRange,
  type CalendarRangeProps,
  type CalendarSharedProps,
  type CalendarSingleProps,
} from './Calendar';
export {
  DatePicker,
  type DatePickerProps,
  type DatePickerRangeProps,
  type DatePickerSingleProps,
  type DatePickerSize,
} from './DatePicker';
export { Slot, type SlotAllProps, type SlotProps } from './Slot';
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TabsActivationMode,
  type TabsContentProps,
  type TabsListProps,
  type TabsListVariant,
  type TabsOrientation,
  type TabsProps,
  type TabsTriggerProps,
} from './Tabs';
export {
  NavigationTabs,
  resolveActiveNavigationHref,
  type NavigationTabItem,
  type NavigationTabsLinkComponent,
  type NavigationTabsLinkProps,
  type NavigationTabsProps,
} from './NavigationTabs';
export {
  DataTable,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type DataTableProps,
  type TableAlign,
  type TableBodyProps,
  type TableCaptionProps,
  type TableCellProps,
  type TableColumn,
  type TableDensity,
  type TableFooterProps,
  type TableHeadProps,
  type TableHeaderProps,
  type TableProps,
  type TableRootProps,
  type TableRowProps,
} from './Table';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type DropdownMenuAlign,
  type DropdownMenuCheckboxItemProps,
  type DropdownMenuContentProps,
  type DropdownMenuGroupProps,
  type DropdownMenuItemProps,
  type DropdownMenuLabelProps,
  type DropdownMenuProps,
  type DropdownMenuRadioGroupProps,
  type DropdownMenuRadioItemProps,
  type DropdownMenuSeparatorProps,
  type DropdownMenuTriggerProps,
} from './DropdownMenu';
export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  type PopoverAlign,
  type PopoverContentProps,
  type PopoverDescriptionProps,
  type PopoverHeaderProps,
  type PopoverPadding,
  type PopoverProps,
  type PopoverTitleProps,
  type PopoverTriggerProps,
} from './Popover';
export { Separator, type SeparatorOrientation, type SeparatorProps } from './Separator';
export {
  Pagination,
  type PaginationLabels,
  type PaginationProps,
  type PaginationSummary,
} from './Pagination';
export { Skeleton, type SkeletonProps, type SkeletonShape } from './Skeleton';
export {
  ProgressDots,
  Stepper,
  type ProgressDotsProps,
  type StepperProps,
  type StepperStep,
} from './Stepper';
export { OtpInput, type OtpInputProps } from './OtpInput';
export {
  ProgressBar,
  ProgressRing,
  type ProgressBarProps,
  type ProgressBarSize,
  type ProgressRingProps,
} from './Progress';
export { CopyField, type CopyFieldProps } from './CopyField';
export {
  AmbientBackground,
  type AmbientBackgroundProps,
  type AmbientBackgroundVariant,
} from './AmbientBackground';
export { Tooltip, type TooltipProps } from './Tooltip';
export {
  PageHeader,
  type PageHeaderProps,
} from './PageHeader';
export {
  StatTile,
  type StatTileProps,
  type StatTone,
} from './StatTile';
export {
  Toolbar,
  ToolbarGroup,
  ToolbarSpacer,
  type ToolbarGroupProps,
  type ToolbarProps,
  type ToolbarSpacerProps,
} from './Toolbar';
export {
  IconButton,
  type IconButtonProps,
  type IconButtonSize,
  type IconButtonVariant,
} from './IconButton';
export {
  ConfirmDialog,
  type ConfirmDialogProps,
} from './ConfirmDialog';
export { TINT_TONES, toneFromString, type TintTone } from './tone';
export { StatusDot, type StatusDotProps, type StatusDotSize } from './StatusDot';
export { IconTile, type IconTileProps, type IconTileSize } from './IconTile';
export { Avatar, avatarInitials, type AvatarProps, type AvatarSize } from './Avatar';
export { Page, type PageProps, type PageWidth } from './Page';
export {
  SectionHeading,
  type SectionHeadingLevel,
  type SectionHeadingProps,
} from './SectionHeading';
export {
  StatTileGrid,
  type StatTileGridColumns,
  type StatTileGridProps,
} from './StatTileGrid';
export { SearchField, type SearchFieldProps } from './SearchField';
export {
  FilterChip,
  FilterChipRow,
  type FilterChipProps,
  type FilterChipRowProps,
} from './FilterChip';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedControlSize,
  type SegmentedOption,
} from './SegmentedControl';
export {
  TableFrame,
  TableSkeleton,
  type TableFrameProps,
  type TableSkeletonProps,
} from './TableFrame';
export {
  DateRangeFilter,
  EMPTY_DATE_RANGE,
  formatDateRange,
  isSameDateRange,
  isValidDateRange,
  type DateRange,
  type DateRangeFilterLabels,
  type DateRangeFilterProps,
  type DateRangeFilterSize,
  type DateRangePreset,
} from './DateRangeFilter';
export {
  menuStyle,
  useAnchoredMenu,
  type AnchoredMenuOptions,
  type MenuPosition,
} from './useAnchoredMenu';
