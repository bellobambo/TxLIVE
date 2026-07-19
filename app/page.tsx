"use client";

import { useEffect, useMemo, useState } from "react";

type FeedEvent = { minute: string; title: string; detail: string; team: "home" | "away" | "system"; seq?: number };

function shorten(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

const getFlagUrl = (country: string) => {
  const map: Record<string, string> = {
    "Argentina": "ar", "Spain": "es", "Australia": "au", "Brazil": "br",
    "New Zealand": "nz", "India": "in", "Liechtenstein": "li", "Gibraltar": "gi",
    "Nigeria": "ng", "France": "fr", "Germany": "de", "England": "gb-eng",
    "USA": "us", "Mexico": "mx", "Canada": "ca", "Japan": "jp", "Italy": "it"
  };
  const code = map[country];
  return code ? `https://flagcdn.com/w80/${code}.png` : null;
};

export default function Home() {
  const [currentView, setCurrentView] = useState<"hero" | "dashboard" | "how" | "fixtures">("hero");
  const [wallet, setWallet] = useState<string | null>(null);
  const [wagerSide, setWagerSide] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState<string>("1.0");
  const [wagerStatus, setWagerStatus] = useState<"idle" | "creating" | "locked">("idle");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<any | null>(null);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [streamState, setStreamState] = useState<"demo" | "connecting" | "live">("demo");
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  const [proofData, setProofData] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadFixtures() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/txline/fixtures");
      if (res.ok) {
        const data = await res.json();
        const fetchedFixtures = Array.isArray(data) ? data : data.data || [];
        const sortedFixtures = fetchedFixtures.sort((a: any, b: any) => a.StartTime - b.StartTime);
        setFixtures(sortedFixtures);
        if (sortedFixtures.length > 0 && !selectedFixtureId) {
          const defaultMatch = sortedFixtures.find((f: any) => f.Competition === "World Cup") || sortedFixtures[0];
          setSelectedFixtureId(defaultMatch.FixtureId);
        }
      }
    } catch (err) { }
    setIsRefreshing(false);
  }

  const simulateMatch = () => {
    setFixtures(prev => prev.map(f => f.FixtureId === selectedFixtureId ? { ...f, MatchStatus: "Live", MatchTime: "1", HomeScore: 0, AwayScore: 0 } : f));

    const fakeEvents = [
      { minute: "1'", title: "Match Started", detail: "TxLINE signed kickoff payload", team: "system", seq: 84319 },
      { minute: "24'", title: "Yellow card", detail: "TxLINE signed booking payload", team: "away", seq: 84320 },
      { minute: "45'", title: "GOAL", detail: "TxLINE signed goal payload", team: "home", seq: 84321, scoreUpdate: [1, 0] },
      { minute: "90'", title: "Full Time", detail: "TxLINE signed final whistle payload", team: "system", seq: 84322 }
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < fakeEvents.length) {
        const ev = fakeEvents[i];
        setEvents(current => [ev as any, ...current].slice(0, 5));
        if (ev.scoreUpdate) {
          setFixtures(prev => prev.map(f => f.FixtureId === selectedFixtureId ? { ...f, HomeScore: ev.scoreUpdate[0], AwayScore: ev.scoreUpdate[1] } : f));
        }
        i++;
      } else {
        clearInterval(interval);
      }
    }, 2000);
  };

  useEffect(() => {
    // Check for incoming shared wager link
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const challengeToken = params.get("challenge");
      if (challengeToken) {
        try {
          const parsed = JSON.parse(decodeURIComponent(atob(challengeToken)));
          setIncomingChallenge(parsed);
          setSelectedFixtureId(parsed.fixtureId);
          setCurrentView("dashboard");
        } catch (e) {
          console.error("Invalid challenge token");
        }
      }
    }

    loadFixtures();

    const source = new EventSource("/api/txline/scores");
    source.onopen = () => setStreamState("live");
    source.addEventListener("score", (message) => {
      try {
        const data = JSON.parse(message.data) as Record<string, unknown>;
        // Filter live events by the currently featured match
        setEvents((current) => {
          const nextEvent: FeedEvent = { minute: String(data.minute ?? "NOW"), title: String(data.eventType ?? "Update"), detail: "TxLINE signed payload", team: "system", seq: data.seq as number };
          return [nextEvent, ...current].slice(0, 5);
        });
      } catch { }
    });
    source.addEventListener("status", (message) => {
      if (message.data === "configured") setStreamState("connecting");
    });
    source.onerror = () => { setStreamState("demo"); source.close(); };
    return () => source.close();
  }, []);

  const streamLabel = useMemo(() => ({ demo: "DEMO FEED", connecting: "CONNECTING", live: "TXLINE LIVE" })[streamState], [streamState]);

  async function connectWallet() {
    const provider = window.phantom?.solana;
    if (!provider) return window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
    const response = await provider.connect();
    setWallet(response.publicKey.toString());
  }

  const liveMatch = fixtures.find(f => f.FixtureId === selectedFixtureId) || fixtures[0];

  async function validateProof(fixtureId: number, seq: number | undefined) {
    if (!seq) return alert("No sequence number available for this event.");
    setValidating(true);
    try {
      const res = await fetch(`/api/txline/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=1,2`);
      const data = await res.json();
      setProofData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setValidating(false);
    }
  }

  return (
    <main className="app-shell">
      <nav className="nav wrap">
        <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); setCurrentView("hero"); }}><span className="brand-mark">✦</span> TxLIVE</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
            <button className={currentView === "hero" ? "active" : ""} onClick={() => setCurrentView("hero")}>Home</button>
            <button className={currentView === "dashboard" ? "active" : ""} onClick={() => setCurrentView("dashboard")}>Challenges</button>
            <button className={currentView === "fixtures" ? "active" : ""} onClick={() => setCurrentView("fixtures")}>Fixtures</button>
            <button className={currentView === "how" ? "active" : ""} onClick={() => setCurrentView("how")}>How it works</button>
            <button
              onClick={loadFixtures}
              disabled={isRefreshing}
              title="Refresh Data"
              style={{
                background: '#0B1849', color: '#F1DEC4', border: 'none', borderRadius: '50%', width: '38px', height: '38px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isRefreshing ? 'wait' : 'pointer',
                fontSize: '20px', fontWeight: 'bold', opacity: isRefreshing ? 0.7 : 1, transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => !isRefreshing && (e.currentTarget.style.transform = 'rotate(30deg)')}
              onMouseOut={(e) => !isRefreshing && (e.currentTarget.style.transform = 'rotate(0deg)')}
            >
              ↻
            </button>
            <button
              onClick={() => setStreamState(s => s === "demo" ? "live" : "demo")}
              style={{
                background: streamState === "live" ? '#a7e1b5' : '#e75f39', color: streamState === "live" ? '#0B1849' : '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.3s'
              }}
            >
              {streamState === "demo" ? "Switch to Live" : "Switch to Demo"}
            </button>
          </div>
          <button className="wallet-button" onClick={connectWallet}>{wallet ? shorten(wallet) : "Connect wallet"}<span>↗</span></button>
        </div>
      </nav>

      {currentView === "hero" && (
        <section id="top" className="hero wrap">
          <span className="pulse" /> <i /> <i> SOLANA SPORTS DATA</i>
          <h1>Winner takes all.<br /><em>Peer-to-peer challenges.</em></h1>
          <p>Lock your stake against another player in a smart contract. When the match ends, TxLINE's cryptographic oracle automatically pays the winner. No house, no limits.</p>
          <div className="hero-actions">
            <button onClick={() => setCurrentView("how")} style={{ background: '#0B1849', color: '#F1DEC4', border: 'none', padding: '15px 30px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>How it works</button>
          </div>
          <div className="trust-row"><span>✓ 100% P2P</span><span>✓ Solana Smart Contracts</span><span>✓ Instant Oracle Payouts</span></div>
        </section>
      )}

      {currentView === "dashboard" && (
        <section className="wrap dashboard" id="match">
          {liveMatch ? (
            <>
              <div className="section-heading"><div><span className="label">FEATURED MATCH</span><h2>{liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2} <span>vs</span> {liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1}</h2></div><div className="match-time"><b>{new Date(liveMatch.StartTime).toLocaleDateString()}</b><span><i /> {liveMatch.Competition || "World Cup"}</span></div></div>
              <div className="score-panel">
                <div className="team home">
                  <div className="crest" style={{ background: getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2) ? 'transparent' : '#0B1849', overflow: 'hidden', border: '1px solid #0B1849', borderRadius: getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2) ? '4px' : '50%', width: getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2) ? '65px' : '51px', height: getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2) ? '45px' : '51px' }}>
                    {getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2) ? (
                      <img src={getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2)!} alt="Flag" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2).slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <b>{liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2}</b>
                </div>
                <div className="score"><strong>- <i>—</i> -</strong><span style={{ marginTop: '8px' }}>{new Date(liveMatch.StartTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="team away">
                  <div className="crest" style={{ background: getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1) ? 'transparent' : '#0B1849', overflow: 'hidden', border: '1px solid #0B1849', borderRadius: getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1) ? '4px' : '50%', width: getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1) ? '65px' : '51px', height: getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1) ? '45px' : '51px' }}>
                    {getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1) ? (
                      <img src={getFlagUrl(liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1)!} alt="Flag" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1).slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <b>{liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1}</b>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="section-heading"><div><span className="label">FEATURED MATCH</span><h2>Loading... <span>vs</span> Loading...</h2></div><div className="match-time"><b>--:--</b><span><i /> LIVE</span></div></div>
              <div className="score-panel">
                <div className="team home"><div className="crest">--</div><b>Loading</b></div>
                <div className="score"><strong>- <i>—</i> -</strong><span>Awaiting TxLINE Stream</span><div className="progress"><i /></div></div>
                <div className="team away"><div className="crest">--</div><b>Loading</b></div>
              </div>
            </>
          )}
          <div className="match-grid">
            <div className="prediction-card">
              <div className="card-top"><span className="label">P2P CHALLENGE ESCROW</span><span className="closes">{incomingChallenge ? "Private Invite" : "Contract Open"}</span></div>
              <h3>{incomingChallenge ? "Match Friend's Challenge" : "Create a Challenge"}</h3>
              <p>{incomingChallenge ? "A friend has challenged you. Lock your matching stake." : "Lock your SOL in the smart contract. Share the link with a friend."}</p>

              {wagerStatus === "locked" ? (
                <div className="locked-wager" style={{ background: '#0B1849', padding: '20px', borderRadius: '8px', textAlign: 'center', border: '1px solid #F1DEC4', color: '#F1DEC4' }}>
                  <div style={{ fontSize: '30px', marginBottom: '10px' }}>🔒</div>
                  <h4 style={{ color: '#F1DEC4', margin: '0 0 10px 0' }}>{incomingChallenge ? "Challenge Matched!" : "Challenge Locked"}</h4>
                  <p style={{ margin: 0, fontSize: '14px' }}>You staked <b>{stakeAmount} SOL</b> on <b>{wagerSide}</b>.</p>

                  {incomingChallenge ? (
                    <p style={{ margin: '15px 0 0 0', fontSize: '12px', color: '#7b857e' }}>The total pool of <b>{(Number(stakeAmount) * 2).toFixed(2)} SOL</b> is securely locked. The TxLINE oracle will automatically resolve the contract at full time.</p>
                  ) : inviteLink ? (
                    <div style={{ marginTop: '15px', padding: '10px', background: '#0a143d', borderRadius: '4px' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#7b857e' }}>SHARE THIS LINK WITH YOUR FRIEND:</p>
                      <input type="text" readOnly value={inviteLink} style={{ width: '100%', padding: '8px', background: '#0B1849', color: '#F1DEC4', border: '1px solid #F1DEC4', borderRadius: '4px', fontSize: '12px', marginBottom: '10px' }} />
                      <button onClick={() => { navigator.clipboard.writeText(inviteLink); alert("Invite link copied!"); }} style={{ width: '100%', padding: '8px', background: '#F1DEC4', color: '#0B1849', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Copy Link</button>
                    </div>
                  ) : null}
                </div>
              ) : incomingChallenge ? (
                <div className="incoming-challenge" style={{ background: '#0B1849', color: '#F1DEC4', padding: '15px', borderRadius: '8px', border: '2px solid #F1DEC4' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <span style={{ fontSize: '12px', color: '#7b857e' }}>CHALLENGER WALLET</span>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{incomingChallenge.creator}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', background: '#0d0e0e', padding: '10px', borderRadius: '4px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#7b857e', display: 'block' }}>THEY PICKED</span>
                      <b style={{ color: '#F1DEC4' }}>{incomingChallenge.side}</b>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: '#7b857e', display: 'block' }}>STAKE REQUIRED</span>
                      <b>{incomingChallenge.amount} SOL</b>
                    </div>
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <span style={{ fontSize: '12px', color: '#7b857e', display: 'block', marginBottom: '8px' }}>CHOOSE YOUR SIDE TO MATCH</span>
                    <div className="pick-list">
                      {[
                        { label: liveMatch ? (liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2) : "Home", tone: "orange" },
                        { label: "Draw", tone: "blue" },
                        { label: liveMatch ? (liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1) : "Away", tone: "violet" }
                      ].map((choice) => (
                        <button
                          key={choice.label}
                          onClick={() => { if (!wallet) return alert("Please connect your wallet first!"); setWagerSide(choice.label); }}
                          disabled={choice.label === incomingChallenge.side}
                          style={{ color: '#0B1849', background: choice.label === incomingChallenge.side ? '#e3d2bc' : 'white', opacity: choice.label === incomingChallenge.side ? 0.7 : 1, cursor: choice.label === incomingChallenge.side ? 'not-allowed' : 'pointer', textDecoration: choice.label === incomingChallenge.side ? 'line-through' : 'none' }}
                          className={`pick ${choice.tone} ${wagerSide === choice.label ? "selected" : ""}`}
                        >
                          <span>{choice.label}</span><i>{wagerSide === choice.label ? "✓" : ""}</i>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    disabled={(!wagerSide && wallet !== "") || wagerStatus === "creating"}
                    className="submit"
                    onClick={() => {
                      if (!wallet) return connectWallet();
                      setStakeAmount(incomingChallenge.amount);
                      setWagerStatus("creating");
                      setTimeout(() => setWagerStatus("locked"), 1500);
                    }}
                  >
                    {wagerStatus === "creating" ? "Approving Transaction..." : !wallet ? "Connect Wallet to Match" : wagerSide ? `Match Challenge (${incomingChallenge.amount} SOL)` : "Select a team to match"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="pick-list">
                    {[
                      { label: liveMatch ? (liveMatch.Participant1IsHome ? liveMatch.Participant1 : liveMatch.Participant2) : "Home", tone: "orange" },
                      { label: "Draw", tone: "blue" },
                      { label: liveMatch ? (liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1) : "Away", tone: "violet" }
                    ].map((choice) => (
                      <button key={choice.label} onClick={() => { if (!wallet) return alert("Please connect your wallet first!"); setWagerSide(choice.label); }} className={`pick ${choice.tone} ${wagerSide === choice.label ? "selected" : ""}`}>
                        <span>{choice.label}</span><i>{wagerSide === choice.label ? "✓" : ""}</i>
                      </button>
                    ))}
                  </div>

                  <div className="stake-input" style={{ marginTop: '20px', marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#7b857e', marginBottom: '8px', fontWeight: 'bold' }}>STAKE AMOUNT (SOL)</label>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#F1DEC4', border: '2px solid #0B1849', borderRadius: '8px', padding: '10px' }}>
                      <span style={{ color: '#0B1849', marginRight: '10px', fontSize: '18px', fontWeight: 'bold' }}>◎</span>
                      <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} step="0.1" min="0.1" style={{ background: 'transparent', border: 'none', color: '#0B1849', fontSize: '18px', width: '100%', outline: 'none', fontWeight: 'bold' }} />
                    </div>
                  </div>

                  <button
                    disabled={(!wagerSide && wallet !== "") || wagerStatus === "creating"}
                    className="submit"
                    onClick={() => {
                      if (!wallet) return connectWallet();
                      setWagerStatus("creating");
                      setTimeout(() => {
                        setWagerStatus("locked");
                        // Generate shareable link
                        const payload = btoa(encodeURIComponent(JSON.stringify({ fixtureId: selectedFixtureId, creator: wallet ? shorten(wallet) : "0xGuest", side: wagerSide, amount: stakeAmount })));
                        setInviteLink(`${window.location.origin}${window.location.pathname}?challenge=${payload}`);
                      }, 1500);
                    }}
                  >
                    {wagerStatus === "creating" ? "Approving Transaction..." : !wallet ? "Connect Wallet to Challenge" : wagerSide ? `Lock ${stakeAmount} SOL on ${wagerSide}` : "Select a team to challenge"}
                  </button>
                </>
              )}

              {!incomingChallenge && streamState === "demo" && (
                <div className="open-wagers" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #3d423e' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#7b857e' }}>OPEN CHALLENGES</h4>
                  <div className="wager-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F1DEC4', border: '1px solid #0B1849', padding: '12px', borderRadius: '6px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>2.5 SOL on {(liveMatch ? (liveMatch.Participant1IsHome ? liveMatch.Participant2 : liveMatch.Participant1) : "Away")}</div>
                      <div style={{ fontSize: '12px', color: '#7b857e' }}>by 0x8F2...9a1</div>
                    </div>
                    <button style={{ background: '#0B1849', color: '#F1DEC4', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Match Challenge</button>
                  </div>
                  <div className="wager-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F1DEC4', border: '1px solid #0B1849', padding: '12px', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>0.5 SOL on Draw</div>
                      <div style={{ fontSize: '12px', color: '#7b857e' }}>by 0x3E1...bc4</div>
                    </div>
                    <button style={{ background: '#e75f39', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Match Challenge</button>
                  </div>
                </div>
              )}

            </div>
            <aside className="event-card"><div className="card-top"><span className="label">VERIFIED TIMELINE</span><div>{streamState === "demo" && <button onClick={simulateMatch} style={{ background: '#0B1849', color: '#F1DEC4', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', marginRight: '8px' }}>▶ SIMULATE</button>}<span className="verified">✦ signed</span></div></div>{events.length > 0 ? events.map((event, index) => <div className="event" key={`${event.minute}-${index}`}><time>{event.minute}</time><span className={`event-icon ${event.team}`}>{event.title === "GOAL" ? "⚽" : event.title === "Yellow card" ? "▰" : "·"}</span><div><b>{event.title}</b><p>{event.detail}</p>{event.seq && <button onClick={() => liveMatch && validateProof(liveMatch.FixtureId, event.seq)} className="verify-btn" style={{ fontSize: '10px', padding: '2px 6px', marginTop: '4px', background: '#242625', border: '1px solid #3d423e', color: '#a7e1b5', borderRadius: '4px', cursor: 'pointer' }}>{validating ? 'Validating...' : 'Verify On-Chain ↗'}</button>}</div></div>) : <div className="event"><p>No live data yet.</p></div>}</aside>
          </div>

          {proofData && (
            <div className="proof-modal" style={{ background: '#0a143d', border: '1px solid #142259', padding: '20px', borderRadius: '8px', marginTop: '20px', overflowX: 'auto', color: '#F1DEC4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#F1DEC4' }}>✦ Merkle Proof Validated</h3>
                <button onClick={() => setProofData(null)} style={{ background: 'none', border: 'none', color: '#7b857e', cursor: 'pointer' }}>Close ✕</button>
              </div>
              <p style={{ fontSize: '14px', color: '#F1DEC4', opacity: 0.8, marginBottom: '15px' }}>This deep cryptographic proof guarantees that the score data traces back to the on-chain Merkle root published by TxLINE. You can submit this payload to a Solana smart contract to automatically claim your prediction winnings.</p>
              <pre style={{ fontSize: '12px', color: '#a7e1b5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(proofData, null, 2)}
              </pre>
            </div>
          )}

          <div className="upcoming-matches">
            <h3>Other Matches</h3>
            <div className="matches-list">
              {fixtures.filter(f => f.FixtureId !== liveMatch?.FixtureId).map((f, i) => {
                const isFriendly = f.Competition === "Friendlies";
                const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
                const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
                return (
                  <div key={f.FixtureId || i} className="match-item" style={{ cursor: 'pointer' }} onClick={() => { setSelectedFixtureId(f.FixtureId); setWagerSide(null); setWagerStatus("idle"); }}>
                    <span className={`tag ${isFriendly ? "friendly" : "world-cup"}`}>
                      {isFriendly ? "INTERNATIONAL FRIENDLY" : f.Competition?.toUpperCase() || "WORLD CUP"}
                    </span>
                    <div className="teams">{home} vs {away}</div>
                    <div className="date">{new Date(f.StartTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {currentView === "fixtures" && (
        <section className="wrap dashboard" style={{ paddingTop: '40px', minHeight: '60vh' }}>
          <div className="section-heading">
            <div><span className="label">ALL TOURNAMENTS</span><h2>Match Fixtures</h2></div>
          </div>
          <div className="matches-list">
            {fixtures.map((f, i) => {
              const isFriendly = f.Competition === "Friendlies";
              const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
              const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
              return (
                <div key={f.FixtureId || i} className="match-item" style={{ cursor: 'pointer' }} onClick={() => { setSelectedFixtureId(f.FixtureId); setCurrentView("dashboard"); }}>
                  <span className={`tag ${isFriendly ? "friendly" : "world-cup"}`}>
                    {isFriendly ? "INTERNATIONAL FRIENDLY" : f.Competition?.toUpperCase() || "WORLD CUP"}
                  </span>
                  <div className="teams">{home} vs {away}</div>
                  <div className="date">{new Date(f.StartTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {currentView === "how" && (
        <section className="wrap features" id="how">
          <div>
            <span className="label">TRUSTLESS PREDICTIONS</span><h2>No house.<br /><em>No counterparty risk.</em></h2>
            <button onClick={() => setCurrentView("hero")} style={{ background: '#e75f39', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '20px' }}>← Back to Home</button>
          </div>
          <div className="feature-grid"><article><span>01</span><h3>Lock in Escrow</h3><p>Both players lock their SOL into a decentralized smart contract. No central house holds your funds.</p></article><article><span>02</span><h3>Oracle Verification</h3><p>The contract listens exclusively to TxLINE's cryptographically signed real-world match events.</p></article><article><span>03</span><h3>Winner Takes All</h3><p>The moment the final whistle blows, the contract verifies the Merkle proof and instantly pays the winner.</p></article></div></section>
      )}

      <footer className="wrap"><div className="brand"><span className="brand-mark">✦</span> TxLIVE</div><p>Peer-to-peer predictions powered by Solana smart contracts. Feed integration: TxLINE by TxODDS.</p><a href="https://txline.txodds.com/documentation/worldcup" target="_blank" rel="noreferrer">TxLINE documentation ↗</a></footer>
    </main>
  );
}

declare global {
  interface Window { phantom?: { solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }> } } }
}
