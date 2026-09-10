import type { AvatarRecipe } from "./contracts";

export function Avatar({
  recipe,
  size = 32,
}: {
  recipe: AvatarRecipe;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="avatar"
    >
      <rect width="100" height="100" rx="12" fill="#14202e" />
      {Array.from({ length: recipe.lobes }, (_, i) => (
        <path
          key={i}
          d={`M${12 + i * 10} 80 L${22 + i * 10} ${15 + ((recipe.seed + i * 17) % 45)} L${32 + i * 10} 80`}
          fill="none"
          stroke={`hsl(${(recipe.hue + i * 12) % 360} 60% 68%)`}
          strokeWidth="5"
        />
      ))}
    </svg>
  );
}
