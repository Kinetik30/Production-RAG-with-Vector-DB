import { useState, useRef, useEffect } from "react";
import "./CustomSelect.css";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: (string | CustomSelectOption)[];
  value: string;
  onChange: (val: string) => void;
  size?: "sm" | "md";
  className?: string;
  icon?: React.ReactNode;
  label?: string;
}

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="custom-select__chevron">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function CustomSelect({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  icon,
  label,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: CustomSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((o) => o.value === value) || normalizedOptions[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`custom-select-container custom-select-container--${size} ${isOpen ? "custom-select-container--open" : ""} ${className}`}
    >
      <button
        type="button"
        className="custom-select__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {icon && <span className="custom-select__icon">{icon}</span>}
        {label && <span className="custom-select__prefix">{label}</span>}
        <span className="custom-select__label">{selectedOption ? selectedOption.label : value}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="custom-select__dropdown animate-fade-in-scale">
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`custom-select__option ${isSelected ? "custom-select__option--selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
