interface NeedleProps {
  value: string;
  label?: string;
  tone?: 'ink' | 'paper';
}

export function Needle({ value, label = '目标数字', tone = 'ink' }: NeedleProps) {
  return (
    <div className={'needle needle--' + tone} role="img" aria-label={label + ' ' + value}>
      <span className="needle__label mono" aria-hidden="true">
        {label}
      </span>
      <span className="needle__cells" aria-hidden="true">
        {value.split('').map((character, index) => (
          <span className="needle__cell" key={index}>
            {character}
          </span>
        ))}
      </span>
    </div>
  );
}
