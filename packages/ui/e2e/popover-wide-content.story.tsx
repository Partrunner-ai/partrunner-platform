import { Popover, PopoverContent, PopoverTrigger, Button } from '../src';

/**
 * A popover whose content cannot reflow, opened from the right edge of the viewport.
 *
 * A small trigger sits against the right edge with a fixed-width grid in its
 * panel. The grid keeps the story focused on layout geometry.
 */
export function WidePopoverAtRightEdge() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 0, margin: 0 }}>
      <Popover maxHeight={480}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Fecha
          </Button>
        </PopoverTrigger>
        {/* Start alignment exercises the edge-collision path. */}
        <PopoverContent align="start">
          <div
            data-testid="wide-content"
            style={{
              width: 320,
              minWidth: 320,
              height: 450,
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
            }}
          >
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} data-testid={`col-${index}`}>
                {index}
              </span>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
