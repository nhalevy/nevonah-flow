import { ImageResponse } from "next/og";

// App icon for the home screen: the NEVONAH FLOW waves on deep ink.
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = raw === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#23212b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#f6f4f0" strokeWidth={2.2} strokeLinecap="round">
          <path d="M4 14c3-6 6 2 9-4s5-2 7-4" />
          <path d="M4 19c3-6 6 2 9-4s5-2 7-4" opacity="0.5" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
