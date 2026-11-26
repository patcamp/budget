"use client";

function Skel({
  width = "100%",
  height = 14,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton-block"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

export function AuthBootSkeleton() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      aria-busy="true"
      aria-label="Loading application"
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--bg-panel)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Skel width={120} height={20} />
        <Skel width="70%" height={12} />
        <Skel height={40} radius={8} style={{ marginTop: 8 }} />
        <Skel height={40} radius={8} />
        <Skel width="100%" height={42} radius={8} style={{ marginTop: 4 }} />
      </div>
    </div>
  );
}

export function AppLoadingSkeleton({ pathname }: { pathname: string }) {
  const isOverview = pathname.startsWith("/overview");
  const isInvestments = pathname.startsWith("/investments");
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return (
      <div style={{ padding: "20px 24px", maxWidth: 960, margin: "0 auto" }} aria-busy="true" aria-label="Loading admin">
        <Skel width={100} height={22} />
        <Skel width={260} height={12} style={{ marginTop: 8, marginBottom: 20 }} />
        <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 24 }}>
          {[80, 96, 92, 88, 70].map((w, i) => (
            <Skel key={i} width={w} height={18} />
          ))}
        </div>
        <div className="paycheck-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <Skel width={80} height={12} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Skel height={40} radius={8} />
                <Skel height={40} radius={8} />
              </div>
            </div>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <Skel width={120} height={12} />
              <Skel height={40} radius={8} />
              <Skel height={40} radius={8} />
            </div>
          </div>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <Skel width={130} height={12} />
            <Skel height={16} />
            <Skel height={16} />
            <Skel height={16} />
            <Skel height={22} style={{ marginTop: 8 }} />
            <Skel height={42} radius={10} style={{ marginTop: 10 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%", paddingBottom: 80 }} aria-busy="true" aria-label="Loading budget data">
      {/* Header skeleton */}
      <div
        style={{
          background: "linear-gradient(160deg,var(--bg-panel) 0%,var(--bg-page) 100%)",
          borderBottom: "1px solid var(--border)",
          padding: "20px 20px 16px",
        }}
      >
        <Skel width={110} height={10} style={{ marginBottom: 8 }} />
        <Skel width={180} height={24} />
        <Skel width={220} height={12} style={{ marginTop: 8 }} />
        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <Skel width={120} height={36} radius={8} />
          <Skel width={120} height={36} radius={8} />
          <Skel width={110} height={36} radius={8} />
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {isOverview ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px" }}>
                  <Skel width={84} height={10} style={{ marginBottom: 8 }} />
                  <Skel width={90} height={22} />
                </div>
              ))}
            </div>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
              <Skel width={180} height={14} style={{ marginBottom: 16 }} />
              <Skel height={190} radius={8} />
            </div>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Skel width={130} height={13} />
                    <Skel width={60} height={12} />
                  </div>
                  <Skel height={5} radius={3} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Hero skeleton (This Period / Investments) */}
            <div
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "18px 18px 16px",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <Skel width={100} height={11} />
                <Skel width={150} height={36} radius={8} />
                <Skel width={200} height={18} />
                <Skel width={170} height={12} />
              </div>
              <Skel width={96} height={44} radius={8} />
            </div>

            {/* 3 metric cards */}
            <div className="metric-grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="metric-card">
                  <Skel width={64} height={10} style={{ marginBottom: 8 }} />
                  <Skel width={72} height={20} />
                  <Skel width={56} height={10} style={{ marginTop: 6 }} />
                </div>
              ))}
            </div>

            {/* Main list / statement skeleton */}
            <div
              style={{
                background: "var(--bg-panel)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Skel width={110} height={14} />
                <Skel width={120} height={30} radius={6} />
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 6 }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <Skel width="55%" height={13} />
                    <Skel width="30%" height={10} />
                  </div>
                  <Skel width={64} height={14} />
                </div>
              ))}
            </div>

            {/* Secondary cards (Category tiles on This Period) */}
            {!isInvestments && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 270px), 1fr))", gap: 10 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <Skel width={100} height={13} />
                        <Skel width={72} height={10} />
                      </div>
                      <Skel width={54} height={20} />
                    </div>
                    <Skel height={5} radius={3} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
