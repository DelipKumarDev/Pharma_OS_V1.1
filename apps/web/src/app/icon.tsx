import { ImageResponse } from 'next/og';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: 'hsl(173, 80%, 32%)',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 96,
            fontWeight: 800,
            fontFamily: 'sans-serif',
            letterSpacing: -4,
          }}
        >
          Rx
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
