import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  Archive,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Code2,
  FileJson,
  FileText,
  FolderOpen,
  GitCompareArrows,
  Layers,
  LoaderCircle,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Upload,
  Waypoints,
  X,
} from "lucide-react";
import {
  api,
  categories,
  confidence,
  date,
  download,
  severity,
  type Card,
  type Detail,
  type Finding,
  type Snapshot,
} from "./domain";
import "./style.css";

function Brand() {
  return (
    <a className="brand" href="/">
      <span>
        <Waypoints size={22} />
      </span>
      tracelens<i>WORKBENCH</i>
    </a>
  );
}
function App() {
  const [cases, setCases] = useState<Card[]>([]),
    [selected, setSelected] = useState<Detail | null>(null),
    [archived, setArchived] = useState(false),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState("findings"),
    [filter, setFilter] = useState("all"),
    [level, setLevel] = useState("all"),
    [hideResolved, setHideResolved] = useState(false),
    [expanded, setExpanded] = useState(""),
    [notes, setNotes] = useState(""),
    [noteBusy, setNoteBusy] = useState(false),
    [help, setHelp] = useState(false),
    [version, setVersion] = useState("");
  const fail = (e: unknown) => setError((e as Error).message);
  async function list(showArchived = archived) {
    const rows = await api<Card[]>("/cases?archived=" + showArchived);
    setCases(rows);
    return rows;
  }
  async function select(id: string) {
    setError("");
    setBusy(true);
    try {
      const row = await api<Detail>("/cases/" + id);
      setSelected(row);
      setNotes(row.notes);
      setExpanded(row.report.findings[0]?.id || "");
      setTab("findings");
      setFilter("all");
      setLevel("all");
      sessionStorage.setItem("tracelens-case", id);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    list()
      .then((rows) => {
        const old = sessionStorage.getItem("tracelens-case");
        if (old && rows.some((r) => r.id === old)) select(old);
        else if (rows[0]) select(rows[0].id);
        else setSelected(null);
      })
      .catch(fail)
      .finally(() => setLoaded(true));
    api<{ version: string }>("/status")
      .then((r) => setVersion(r.version))
      .catch(() => {});
  }, [archived]);
  async function demo() {
    setBusy(true);
    setError("");
    try {
      const row = await api<Detail>("/cases/demo", "POST");
      setSelected(row);
      setNotes(row.notes);
      setExpanded(row.report.findings[0]?.id || "");
      setTab("findings");
      setArchived(false);
      sessionStorage.setItem("tracelens-case", row.id);
      await list(false);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(finding: Finding) {
    if (!selected) return;
    setBusy(true);
    try {
      const row = await api<Detail>(
        "/cases/" + selected.id + "/findings/" + finding.id,
        "PUT",
        {
          resolved: !selected.resolutions[finding.id],
          revision: selected.revision,
        },
      );
      setSelected(row);
      await list();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function saveNotes(archive = selected?.archived || false) {
    if (!selected) return;
    setNoteBusy(true);
    try {
      const row = await api<Detail>("/cases/" + selected.id, "PATCH", {
        title: selected.title,
        notes,
        archived: archive,
        revision: selected.revision,
      });
      setSelected(row);
      await list();
      if (archive !== archived) setSelected(null);
    } catch (e) {
      fail(e);
    } finally {
      setNoteBusy(false);
    }
  }
  const report = selected?.report,
    visible =
      report?.findings.filter(
        (f) =>
          (filter === "all" || f.category === filter) &&
          (level === "all" || f.severity === level) &&
          (!hideResolved || !selected?.resolutions[f.id]),
      ) || [];
  const resolved = selected
    ? Object.values(selected.resolutions).filter(Boolean).length
    : 0;
  return (
    <div className="app">
      <aside className="rail">
        <Brand />
        <p className="eyebrow">YEREL ÇALIŞMA ALANI</p>
        <nav>
          <button
            className={!archived ? "active" : ""}
            onClick={() => setArchived(false)}
          >
            <GitCompareArrows size={17} />
            İncelemeler <span>{!archived ? cases.length : ""}</span>
          </button>
          <button
            className={archived ? "active" : ""}
            onClick={() => setArchived(true)}
          >
            <Archive size={17} />
            Arşiv
          </button>
        </nav>
        <div className="rail-bottom">
          <div>
            <ShieldCheck size={19} />
            <b>Kanıt sende kalır.</b>
            <p>
              Snapshot ve raporlar bu bilgisayardaki yerel serviste saklanır.
            </p>
          </div>
          <button onClick={() => setHelp(true)}>
            <Terminal size={16} />
            CLI ile snapshot al
            <ArrowRight size={13} />
          </button>
          <small>TraceLens / {version || "bağlanıyor"}</small>
        </div>
      </aside>
      <section className="case-column">
        <header>
          <span>
            <FolderOpen size={15} />
            {archived ? "Arşiv" : "İncelemeler"}
          </span>
          <button
            className="icon"
            aria-label="Yeni inceleme"
            onClick={() => setCreating(true)}
          >
            <Plus size={17} />
          </button>
        </header>
        <label className="search">
          <Search size={15} />
          <input
            aria-label="İnceleme ara"
            placeholder="İnceleme ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>/</kbd>
        </label>
        <div className="case-list">
          {cases
            .filter((c) =>
              c.title
                .toLocaleLowerCase("tr")
                .includes(query.toLocaleLowerCase("tr")),
            )
            .map((c) => (
              <button
                key={c.id}
                className={"case " + (selected?.id === c.id ? "selected" : "")}
                onClick={() => select(c.id)}
              >
                <div>
                  <span className="case-mark">
                    <GitCompareArrows size={15} />
                  </span>
                  <small>{date(c.createdAt)}</small>
                </div>
                <b>{c.title}</b>
                <p>
                  {c.leftLabel}
                  <ArrowRight size={10} />
                  {c.rightLabel}
                </p>
                <footer>
                  {c.summary.errors > 0 && (
                    <span className="mini error-tone">
                      {c.summary.errors} kritik
                    </span>
                  )}
                  {c.summary.warnings > 0 && (
                    <span className="mini warning-tone">
                      {c.summary.warnings} uyarı
                    </span>
                  )}
                  <span className="case-progress">
                    {c.resolved}/{c.summary.rulesTriggered}
                    <Check size={10} />
                  </span>
                </footer>
              </button>
            ))}
          {loaded && !cases.length && (
            <div className="list-empty">
              <Layers size={27} />
              <b>{archived ? "Arşiv henüz boş." : "İlk incelemene hazır."}</b>
              <p>İki snapshot ekleyerek ortamların nerede ayrıldığını gör.</p>
            </div>
          )}
        </div>
        <button className="sample-link" onClick={demo} disabled={busy}>
          <Activity size={15} />
          Örnek incelemeyi aç
          <ArrowRight size={13} />
        </button>
      </section>
      <div className="workspace">
        <header className="topbar">
          <span>
            Çalışma alanı
            <ChevronRight size={13} />
            <b>{selected?.title || "Yeni bir bakış"}</b>
          </span>
          <div>
            <span className="local-state">
              <i />
              Yerel mod
            </span>
            <button className="primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              Yeni inceleme
            </button>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            <TriangleAlert size={16} />
            {error}
            <button
              className="icon"
              aria-label="Hatayı kapat"
              onClick={() => setError("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {!selected ? (
          <main className="welcome">
            <span className="eyebrow">ÇALIŞIYOR. AMA NEREDE?</span>
            <h1>
              İki ortam.
              <br />
              <em>Tek bir gerçek.</em>
            </h1>
            <p>
              “Bende çalışıyor” ile “CI’da bozuluyor” arasındaki farkı
              <br className="desktop" /> sürümler, dosyalar ve log kanıtlarıyla
              incele.
            </p>
            <div className="welcome-diagram" aria-hidden="true">
              <div>
                <Monitor size={27} />
                <b>LOCAL</b>
                <small>node 24 · Windows</small>
              </div>
              <div className="connection">
                <span />
                <GitCompareArrows size={22} />
                <span />
              </div>
              <div>
                <Terminal size={27} />
                <b>CI RUNNER</b>
                <small>node 20 · Linux</small>
              </div>
            </div>
            <div className="welcome-actions">
              <button className="primary" onClick={() => setCreating(true)}>
                <Plus size={16} />
                Snapshot ekle
              </button>
              <button onClick={demo} disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Activity size={15} />
                )}
                Örnekle keşfet
              </button>
            </div>
            <div className="welcome-footer">
              <span>
                <ShieldCheck size={14} />
                Ortam değerleri toplanmaz
              </span>
              <span>
                <Code2 size={14} />
                Otomatik düzeltme çalıştırılmaz
              </span>
            </div>
          </main>
        ) : (
          <main className="case-workspace">
            <section className="heading">
              <div>
                <span className="eyebrow">
                  ORTAM İNCELEMESİ / {selected.id.slice(0, 6).toUpperCase()}
                </span>
                <h1>{selected.title}</h1>
                <p>
                  {date(selected.createdAt)}
                  <span>·</span>
                  {report!.summary.rulesTriggered} bulgu<span>·</span>
                  {resolved} tamamlandı
                </p>
              </div>
              <div>
                <button onClick={() => setTab("sharing")}>
                  <ArrowDownToLine size={15} />
                  Raporu paylaş
                </button>
                <button
                  className="icon"
                  aria-label={
                    selected.archived ? "Arşivden çıkar" : "İncelemeyi arşivle"
                  }
                  disabled={noteBusy}
                  onClick={() => saveNotes(!selected.archived)}
                >
                  <Archive size={17} />
                </button>
              </div>
            </section>
            <section className="environment-pair">
              <Environment side="KAYNAK" snapshot={report!.snapshots.left} />
              <div className="pair-arrow">
                <ArrowLeftRight size={18} />
              </div>
              <Environment side="HEDEF" snapshot={report!.snapshots.right} />
            </section>
            <section className="metrics">
              <button
                onClick={() => {
                  setTab("findings");
                  setLevel("error");
                }}
              >
                <span className="metric-icon critical">
                  <TriangleAlert size={17} />
                </span>
                <div>
                  <strong>{report!.summary.errors}</strong>
                  <small>Öncelikli bulgu</small>
                </div>
                <ArrowRight size={13} />
              </button>
              <button
                onClick={() => {
                  setTab("findings");
                  setLevel("warning");
                }}
              >
                <span className="metric-icon warning">
                  <Activity size={17} />
                </span>
                <div>
                  <strong>{report!.summary.warnings}</strong>
                  <small>Kontrol edilecek fark</small>
                </div>
                <ArrowRight size={13} />
              </button>
              <button
                onClick={() => {
                  setTab("findings");
                  setLevel("all");
                  setHideResolved(true);
                }}
              >
                <span className="metric-icon completed">
                  <ClipboardCheck size={17} />
                </span>
                <div>
                  <strong>
                    {resolved}
                    <i>/{report!.summary.rulesTriggered}</i>
                  </strong>
                  <small>Tamamlanan kontrol</small>
                </div>
                <ArrowRight size={13} />
              </button>
            </section>
            <nav className="tabs">
              {[
                ["findings", "Bulgular"],
                ["environments", "Ortam farkları"],
                ["timeline", "Log izi"],
                ["sharing", "Paylaşım"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key)}
                >
                  {label}
                  {key === "findings" && <span>{report!.findings.length}</span>}
                  {key === "timeline" && <span>{report!.timeline.length}</span>}
                </button>
              ))}
            </nav>
            {tab === "findings" && (
              <section className="findings-area">
                <div className="findings-main">
                  <div className="filters">
                    <div>
                      <button
                        className={filter === "all" ? "active" : ""}
                        onClick={() => setFilter("all")}
                      >
                        Tümü
                      </button>
                      {Object.entries(categories)
                        .filter(([key]) =>
                          report!.findings.some((f) => f.category === key),
                        )
                        .map(([key, label]) => (
                          <button
                            key={key}
                            className={filter === key ? "active" : ""}
                            onClick={() => setFilter(key)}
                          >
                            {label}
                          </button>
                        ))}
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={hideResolved}
                        onChange={(e) => setHideResolved(e.target.checked)}
                      />
                      Tamamlananları gizle
                    </label>
                  </div>
                  {level !== "all" && (
                    <button
                      className="active-filter"
                      onClick={() => setLevel("all")}
                    >
                      {severity[level]} filtresi
                      <X size={12} />
                    </button>
                  )}
                  {!visible.length && (
                    <div className="clean-state">
                      <CheckCheck size={30} />
                      <b>Bu görünümde açık bulgu yok.</b>
                      <p>
                        {report!.unknowns.length
                          ? "Bilinmeyenleri de incele; bulgu olmaması sorunun çözüldüğünü kanıtlamaz."
                          : "Diğer filtreleri ve log izini kontrol edebilirsin."}
                      </p>
                      <button
                        onClick={() => {
                          setLevel("all");
                          setFilter("all");
                          setHideResolved(false);
                        }}
                      >
                        Tüm bulguları göster
                      </button>
                    </div>
                  )}
                  {visible.map((f) => (
                    <article
                      key={f.id}
                      className={
                        "finding " +
                        f.severity +
                        (selected.resolutions[f.id] ? " resolved" : "")
                      }
                    >
                      <div className="finding-top">
                        <button
                          className={
                            "resolve " +
                            (selected.resolutions[f.id] ? "checked" : "")
                          }
                          disabled={busy}
                          aria-label={
                            f.title +
                            (selected.resolutions[f.id]
                              ? " yeniden aç"
                              : " tamamlandı olarak işaretle")
                          }
                          onClick={() => resolve(f)}
                        >
                          {selected.resolutions[f.id] ? (
                            <Check size={13} />
                          ) : null}
                        </button>
                        <button
                          className="finding-title"
                          aria-expanded={expanded === f.id}
                          onClick={() =>
                            setExpanded(expanded === f.id ? "" : f.id)
                          }
                        >
                          <div>
                            <span className={"severity " + f.severity}>
                              {severity[f.severity]}
                            </span>
                            <small>{categories[f.category]}</small>
                          </div>
                          <h3>{f.title}</h3>
                        </button>
                        <button
                          className="icon"
                          aria-label={f.title + " ayrıntıları"}
                          onClick={() =>
                            setExpanded(expanded === f.id ? "" : f.id)
                          }
                        >
                          {expanded === f.id ? (
                            <ChevronDown size={17} />
                          ) : (
                            <ChevronRight size={17} />
                          )}
                        </button>
                      </div>
                      {expanded === f.id && (
                        <div className="finding-body">
                          <div className="confidence">
                            <i className={f.confidence} />
                            {confidence[f.confidence]}
                            <code>{f.rule}</code>
                          </div>
                          <h4>Gözlenen kanıt</h4>
                          <ul>
                            {f.facts.map((text, i) => (
                              <li key={i}>{text}</li>
                            ))}
                          </ul>
                          {f.logEvidence.length > 0 && (
                            <div className="evidence-lines">
                              {f.logEvidence.map((row) => (
                                <button
                                  key={row.line}
                                  onClick={() => {
                                    setTab("timeline");
                                    setTimeout(
                                      () =>
                                        document
                                          .getElementById(
                                            "log-line-" + row.line,
                                          )
                                          ?.scrollIntoView({
                                            block: "center",
                                            behavior: "smooth",
                                          }),
                                      40,
                                    );
                                  }}
                                >
                                  <span>L{row.line}</span>
                                  <code>{row.text}</code>
                                  <ArrowRight size={12} />
                                </button>
                              ))}
                            </div>
                          )}
                          <h4>Sonraki kontrol</h4>
                          <ol>
                            {f.steps.map((text, i) => (
                              <li key={i}>{text}</li>
                            ))}
                          </ol>
                          <footer>
                            <ShieldCheck size={13} />
                            Bu öneriler otomatik çalıştırılmadı.
                          </footer>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <aside className="review-panel">
                  <span className="eyebrow">İNCELEME NOTU</span>
                  <h3>Bir sonraki adımı kaydet.</h3>
                  <p>Yerel notlar paylaşım paketine eklenmez.</p>
                  <textarea
                    aria-label="İnceleme notu"
                    placeholder="Ne denedin, hangi kanıtı bekliyorsun?"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={2000}
                  />
                  <button
                    onClick={() => saveNotes()}
                    disabled={noteBusy || notes === selected.notes}
                  >
                    {noteBusy ? "Kaydediliyor…" : "Notu kaydet"}
                    <Check size={13} />
                  </button>
                  <div className="scope-note">
                    <ShieldCheck size={20} />
                    <b>Fark, tek başına neden değildir.</b>
                    <p>
                      Kurallar gözlenen farkları sıralar. Düzeltmeyi aynı
                      koşullarda yeniden test ederek doğrula.
                    </p>
                  </div>
                  {report!.unknowns.length > 0 && (
                    <div className="unknowns">
                      <span className="eyebrow">AÇIKTA KALANLAR</span>
                      {report!.unknowns.map((u, i) => (
                        <p key={i}>{u}</p>
                      ))}
                    </div>
                  )}
                </aside>
              </section>
            )}
            {tab === "environments" && (
              <EnvironmentTable
                left={report!.snapshots.left}
                right={report!.snapshots.right}
              />
            )}
            {tab === "timeline" && (
              <section className="timeline-view">
                <div className="section-title">
                  <div>
                    <h2>Logdaki izler.</h2>
                    <p>
                      Orijinal satır numaralarıyla seçilmiş hata kanıtı.
                      Maskelenmiş logun tamamı da aşağıda.
                    </p>
                  </div>
                  <span>{report!.timeline.length} hata satırı</span>
                </div>
                <div className="log-events">
                  {report!.timeline.map((row) => (
                    <article id={"log-line-" + row.line} key={row.line}>
                      <div>
                        <i />
                        <code>{row.time?.split("T")[1] || "Zaman yok"}</code>
                        <span>L{row.line}</span>
                      </div>
                      <pre>{row.text}</pre>
                    </article>
                  ))}
                </div>
                {!report!.timeline.length && (
                  <div className="clean-state">
                    <FileText size={25} />
                    <p>Bu incelemeye ait eşleşen hata satırı yok.</p>
                  </div>
                )}
                <details className="full-log">
                  <summary>
                    Maskelenmiş logun tamamı <ChevronDown size={14} />
                  </summary>
                  <pre>{report!.redactedLog || "Log eklenmedi."}</pre>
                </details>
              </section>
            )}
            {tab === "sharing" && (
              <section className="share-view">
                <div className="section-title">
                  <div>
                    <h2>Kanıtı birlikte inceleyin.</h2>
                    <p>
                      Paket yerelde hazırlanır. Bir bağlantı oluşturulmaz ve
                      otomatik gönderilmez.
                    </p>
                  </div>
                  <ShieldCheck size={28} />
                </div>
                <div className="share-grid">
                  <div className="export-card">
                    <Box size={27} />
                    <span className="eyebrow">TANILAMA PAKETİ</span>
                    <h3>Kontrol et. Sonra paylaş.</h3>
                    <p>
                      Proje yolları ve bağımlılık adları da kuruma özel bilgi
                      olabilir. İndirmeden önce aşağıdaki içeriği incele.
                    </p>
                    <ul>
                      {[
                        "report.json",
                        "left.snapshot.json",
                        "right.snapshot.json",
                        "log.redacted.txt",
                        "contextpilot-handoff.md",
                      ].map((name) => (
                        <li key={name}>
                          <FileJson size={14} />
                          {name}
                          <span>yerel</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      className="primary button"
                      href={"/api/cases/" + selected.id + "/export"}
                    >
                      <ArrowDownToLine size={15} />
                      ZIP paketini indir
                    </a>
                  </div>
                  <div className="context-card">
                    <Waypoints size={27} />
                    <span className="eyebrow">CONTEXTPILOT İLE DEVAM ET</span>
                    <h3>İlgili koda geç.</h3>
                    <p>
                      Görev metni bulguları ve ilgili dosya yollarını içerir.
                      Kaynak kod eklenmez. ContextPilot ile proje klasöründe
                      bağlam hazırlayabilirsin.
                    </p>
                    <pre>
                      contextpilot pack "upload runtime configuration"
                      <br /> --root ./project --with-dependencies
                    </pre>
                    <a
                      className="button"
                      href={"/api/cases/" + selected.id + "/handoff"}
                    >
                      <ArrowDownToLine size={15} />
                      Görev metnini indir
                    </a>
                    <small>
                      CLI köprüsü, açıkça seçtiğin güvenilir ContextPilot
                      yardımcısıyla yerelde çalışabilir.
                    </small>
                  </div>
                </div>
                <details className="snapshot-review">
                  <summary>
                    Paylaşım öncesi snapshot ve rapor içeriğini incele
                    <ChevronDown size={14} />
                  </summary>
                  <pre>{JSON.stringify(report, null, 2)}</pre>
                </details>
              </section>
            )}
            <footer className="workspace-footer">
              <span>TRACELENS / EVIDENCE BEFORE ASSUMPTIONS</span>
              <span>
                <ShieldCheck size={12} />
                Yerel analiz · otomatik değişiklik yok
              </span>
            </footer>
          </main>
        )}
      </div>
      {creating && (
        <NewCase
          onClose={() => setCreating(false)}
          onCreated={async (row) => {
            setCreating(false);
            setSelected(row);
            setNotes(row.notes);
            setExpanded(row.report.findings[0]?.id || "");
            setTab("findings");
            setArchived(false);
            setFilter("all");
            setLevel("all");
            sessionStorage.setItem("tracelens-case", row.id);
            await list(false).catch(fail);
          }}
        />
      )}
      {help && (
        <div className="overlay" onClick={() => setHelp(false)}>
          <section className="help-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              className="close icon"
              aria-label="Rehberi kapat"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <Terminal size={28} />
            <h2>Ortamın fotoğrafını çek.</h2>
            <p>
              Proje kökünde CLI ile snapshot al. Betik veya paket yükleme
              kancası çalıştırılmaz.
            </p>
            <pre>
              tracelens capture --root ./project
              <br /> --label "Local" --out local.snapshot.json
            </pre>
            <pre>
              tracelens capture --root ./project
              <br /> --label "CI" --no-probe --out ci.snapshot.json
            </pre>
            <p>
              <b>--no-probe</b> sürüm komutlarını da çalıştırmaz. CI
              karşılaştırması için normal capture komutunu CI adımında
              çalıştırabilirsin.
            </p>
            <button
              className="primary"
              onClick={() => {
                setHelp(false);
                setCreating(true);
              }}
            >
              Snapshot eklemeye geç
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function Environment({
  snapshot: s,
  side,
}: {
  snapshot: Snapshot;
  side: string;
}) {
  return (
    <article>
      <div className="env-icon">
        {side === "KAYNAK" ? <Monitor size={24} /> : <Terminal size={24} />}
      </div>
      <div>
        <span className="eyebrow">{side}</span>
        <h2>{s.label}</h2>
        <p>
          {s.platform.system}
          <span>·</span>
          {s.platform.arch}
          <span>·</span>
          {s.project.name}
        </p>
      </div>
      <span className="snapshot-tag">
        <FileJson size={12} />
        snapshot
      </span>
    </article>
  );
}

function EnvironmentTable({
  left: a,
  right: b,
}: {
  left: Snapshot;
  right: Snapshot;
}) {
  const rows: { section: string; name: string; left: string; right: string }[] =
    [];
  rows.push(
    ...[
      ["İşletim sistemi", a.platform.system, b.platform.system],
      ["Mimari", a.platform.arch, b.platform.arch],
      [
        "Case-sensitive",
        String(a.platform.caseSensitive),
        String(b.platform.caseSensitive),
      ],
    ].map(([name, left, right]) => ({
      section: "Platform",
      name,
      left,
      right,
    })),
  );
  for (const tool of Array.from(
    new Set([...Object.keys(a.tools), ...Object.keys(b.tools)]),
  )) {
    const show = (s: Snapshot) =>
      s.tools[tool]?.status === "available"
        ? s.tools[tool].version || "Bilinmiyor"
        : s.tools[tool]?.status || "Yok";
    rows.push({
      section: "Runtime",
      name: tool,
      left: show(a),
      right: show(b),
    });
  }
  rows.push(
    {
      section: "Proje",
      name: "Paket yöneticisi",
      left: a.project.packageManager,
      right: b.project.packageManager,
    },
    {
      section: "Proje",
      name: "Hedef framework",
      left: a.project.frameworks.join(", ") || "Yok",
      right: b.project.frameworks.join(", ") || "Yok",
    },
  );
  for (const key of new Set(
    [...a.project.env, ...b.project.env].map((x) => x.name),
  )) {
    const show = (s: Snapshot) =>
      s.project.env.find((e) => e.name === key)?.defined
        ? "Tanımlı"
        : "Tanımlı değil";
    rows.push({
      section: "Yapılandırma",
      name: key,
      left: show(a),
      right: show(b),
    });
  }
  for (const key of new Set(
    [...a.project.dependencies, ...b.project.dependencies].map((x) => x.name),
  ))
    rows.push({
      section: "Bağımlılık",
      name: key,
      left:
        a.project.dependencies.find((d) => d.name === key)?.version || "Yok",
      right:
        b.project.dependencies.find((d) => d.name === key)?.version || "Yok",
    });
  return (
    <section className="environment-table">
      <div className="section-title">
        <div>
          <h2>Yan yana, olduğu gibi.</h2>
          <p>
            Bildirilen bağımlılık aralığı, kurulu paketin gerçek sürümü
            değildir. Ortam değerleri gösterilmez.
          </p>
        </div>
        <span>{rows.filter((r) => r.left !== r.right).length} farklı alan</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ALAN</th>
              <th>{a.label}</th>
              <th>{b.label}</th>
              <th>DURUM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr className={r.left !== r.right ? "different" : ""} key={i}>
                <td>
                  <small>{r.section}</small>
                  <b>{r.name}</b>
                </td>
                <td>
                  <code>{r.left}</code>
                </td>
                <td>
                  <code>{r.right}</code>
                </td>
                <td>
                  <span>{r.left !== r.right ? "Farklı" : "Eşleşiyor"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewCase({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (row: Detail) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("Yeni ortam incelemesi"),
    [left, setLeft] = useState(""),
    [right, setRight] = useState(""),
    [log, setLog] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [paste, setPaste] = useState(false);
  async function file(file: File, set: (s: string) => void) {
    try {
      if (file.size > 1_500_000)
        throw new Error("Snapshot dosyası en fazla 1,5 MB olabilir.");
      const text = await file.text();
      JSON.parse(text);
      set(text);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function sample() {
    setBusy(true);
    setError("");
    try {
      const example = await api<{
        left: Snapshot;
        right: Snapshot;
        log: string;
      }>("/example");
      setLeft(JSON.stringify(example.left, null, 2));
      setRight(JSON.stringify(example.right, null, 2));
      setLog(example.log);
      setTitle("Checkout / Linux CI");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const label = (text: string) => {
    try {
      return (JSON.parse(text) as Snapshot).label || "Snapshot yüklendi";
    } catch {
      return "";
    }
  };
  return (
    <div className="overlay">
      <form
        className="new-dialog"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const body = {
              title,
              left: JSON.parse(left),
              right: JSON.parse(right),
              log,
            };
            if (
              new TextEncoder().encode(JSON.stringify(body)).length > 3_900_000
            )
              throw new Error(
                "Toplam içerik çok büyük; logu veya snapshot boyutunu küçült.",
              );
            await onCreated(await api<Detail>("/cases", "POST", body));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <button
          type="button"
          className="close icon"
          aria-label="Yeni incelemeyi kapat"
          onClick={onClose}
          disabled={busy}
        >
          <X size={18} />
        </button>
        <span className="eyebrow">YENİ İNCELEME</span>
        <h2>İki ortamı masaya koy.</h2>
        <p>
          CLI ile aldığın snapshot dosyalarını ekle. İstersen örnek bir
          karşılaştırmayla başla.
        </p>
        <label className="field-label">
          İnceleme adı
          <input
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
          />
        </label>
        <div className="snapshot-inputs">
          {[
            [left, setLeft, "Kaynak snapshot"],
            [right, setRight, "Hedef snapshot"],
          ].map(([value, setter, name], i) => (
            <label
              key={i}
              className={"snapshot-drop " + (value ? "loaded" : "")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0])
                  file(e.dataTransfer.files[0], setter as (s: string) => void);
              }}
            >
              <span className="eyebrow">
                {i === 0 ? "01 / KAYNAK" : "02 / HEDEF"}
              </span>
              {value ? <Check size={25} /> : <Upload size={25} />}
              <b>{label(value as string) || (name as string)}</b>
              <small>
                {value
                  ? "Değiştirmek için yeni dosya seç"
                  : ".json dosyasını bırak veya seç"}
              </small>
              <input
                aria-label={name as string}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  if (e.target.files?.[0])
                    file(e.target.files[0], setter as (s: string) => void);
                }}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          className="paste-toggle"
          onClick={() => setPaste(!paste)}
        >
          <Code2 size={13} />
          JSON metni yapıştır
          <ChevronDown size={13} />
        </button>
        {paste && (
          <div className="paste-grid">
            <label>
              Kaynak JSON
              <textarea
                aria-label="Kaynak JSON"
                value={left}
                onChange={(e) => setLeft(e.target.value)}
              />
            </label>
            <label>
              Hedef JSON
              <textarea
                aria-label="Hedef JSON"
                value={right}
                onChange={(e) => setRight(e.target.value)}
              />
            </label>
          </div>
        )}
        <label className="field-label">
          Hata logu{" "}
          <small>isteğe bağlı · bilinen gizli bilgiler maskelenir</small>
          <textarea
            aria-label="Hata logu"
            placeholder="Build veya test çıktısını buraya yapıştır…"
            value={log}
            onChange={(e) => setLog(e.target.value)}
            maxLength={1000000}
          />
        </label>
        <div className="privacy-line">
          <ShieldCheck size={15} />
          Yerel notlar dışa aktarılmaz. Metadata paylaşmadan önce
          incelenmelidir.
        </div>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" onClick={sample} disabled={busy}>
            <Activity size={15} />
            Örnek veriyi kullan
          </button>
          <button className="primary" disabled={busy || !left || !right}>
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <GitCompareArrows size={15} />
            )}{" "}
            {busy ? "Kanıtlar inceleniyor…" : "Karşılaştır"}
          </button>
        </footer>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
