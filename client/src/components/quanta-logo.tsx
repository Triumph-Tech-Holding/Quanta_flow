import quantaLogoImage from "@assets/Quanta_Flow_SEM_FUNDO_1770475375407.png";

interface QuantaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function QuantaLogo({ className = "", size = "md" }: QuantaLogoProps) {
  const sizeClasses = {
    sm: "h-[2.6rem]",
    md: "h-[3.25rem]",
    lg: "h-[5.2rem]",
  };

  return (
    <img 
      src={quantaLogoImage} 
      alt="Quanta Flow Logo" 
      className={`${sizeClasses[size]} w-auto object-contain ${className}`}
    />
  );
}

export function QuantaLogoWithText({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <QuantaLogo size="md" />
    </div>
  );
}
