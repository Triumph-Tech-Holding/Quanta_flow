import quantaLogoImage from "@assets/logo_quanta_flow_1770251478040.png";

interface QuantaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function QuantaLogo({ className = "", size = "md" }: QuantaLogoProps) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-16",
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
