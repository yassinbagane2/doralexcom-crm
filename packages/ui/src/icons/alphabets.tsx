import { SVGProps } from "react"

interface AlphabetsIconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

export const Alphabets = ({
  size = 15,
  strokeWidth = 1.5,
  className,
  ...props
}: AlphabetsIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M16 8h4l-4 8h4" />
      <path d="M4 16v-6a2 2 0 1 1 4 0v6" />
      <path d="M4 13h4" />
      <path d="M11 12h2" />
    </svg>
  )
}
