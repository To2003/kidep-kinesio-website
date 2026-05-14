import { useState, useMemo, useEffect } from "react";

// ── Helpers & Dates ─────────────────────────────────────────

function toYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addWeekdays(dateStr, amount) {
  let [y, m, d] = dateStr.split('-').map(Number);
  let date = new Date(y, m - 1, d);
  let remaining = Math.abs(amount);
  const step = amount > 0 ? 1 : -1;
  while (remaining > 0) {
    date.setDate(date.getDate() + step);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      remaining--;
    }
  }
  return toYYYYMMDD(date);
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${days[date.getDay()]}, ${d} de ${months[date.getMonth()]}`;
}

function getTodayWeekday() {
  const d = new Date();
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sunday -> Monday
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
  return toYYYYMMDD(d);
}

const TODAY_STR = getTodayWeekday();

// ── Constants ──────────────────────────────────────────────
const SLOTS = [];
for (let h = 9; h <= 18; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
const CAPACITY = 3;

function getKey(date, slot) { return `${date}::${slot}`; }

function slotLabel(slot) {
  const [h, m] = slot.split(":").map(Number);
  const end = m === 30 ? `${String(h + 1).padStart(2, '0')}:00` : `${String(h).padStart(2, '0')}:30`;
  return `${slot} – ${end}`;
}

// ── Palette ────────────────────────────────────────────────
const P = {
  bg:        "#F5F1EC",
  surface:   "#FDFAF6",
  border:    "#DDD5C8",
  teal:      "#2A7A7B",
  tealLight: "#E6F4F4",
  tealHover: "#225F60",
  terra:     "#C4622D",
  terraLt:   "#FAF0EB",
  text:      "#2B2420",
  muted:     "#7A6F67",
  white:     "#FFFFFF",
  full:      "#FDE8E8",
  fullBdr:   "#E8A9A9",
  available: "#E8F7ED",
  availBdr:  "#7BC89A",
};

// ── Inline styles ──────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh", background: P.bg, fontFamily: "'Georgia', serif",
    color: P.text, padding: "0",
  },
  header: {
    background: P.teal, padding: "20px 32px", display: "flex",
    alignItems: "center", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  headerIcon: { fontSize: 36 },
  headerTitle: { color: P.white, fontSize: 26, fontWeight: "bold", margin: 0, letterSpacing: "-0.5px" },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 16, marginTop: 2 },

  main: { maxWidth: 1000, margin: "0 auto", padding: "28px 20px" },

  // Nav bar
  navCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: P.surface, border: `1.5px solid ${P.border}`, borderRadius: 16,
    padding: "16px 24px", marginBottom: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  navBtn: {
    background: P.tealLight, border: `1.5px solid ${P.teal}`, borderRadius: 10,
    padding: "10px 18px", fontSize: 16, fontWeight: "bold", color: P.teal,
    cursor: "pointer", fontFamily: "'Georgia', serif", transition: "all .15s",
  },
  navDate: {
    fontSize: 20, fontWeight: "bold", color: P.text, letterSpacing: "0.5px",
  },

  // Filter bar
  filterCard: {
    background: P.surface, border: `1.5px solid ${P.border}`, borderRadius: 16,
    padding: "20px 24px", marginBottom: 24,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  filterTitle: { fontSize: 16, fontWeight: "bold", textTransform: "uppercase",
    letterSpacing: 1.2, color: P.muted, marginBottom: 14 },
  filterRow: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" },
  filterGroup: { display: "flex", flexDirection: "column", gap: 6 },
  filterLabel: { fontSize: 16, color: P.muted, fontWeight: "bold" },
  filterInput: {
    border: `1.5px solid ${P.border}`, borderRadius: 10, padding: "10px 14px",
    fontSize: 16, background: P.white, color: P.text, outline: "none",
    minWidth: 180, fontFamily: "'Georgia', serif",
  },
  filterSelect: {
    border: `1.5px solid ${P.border}`, borderRadius: 10, padding: "10px 14px",
    fontSize: 16, background: P.white, color: P.text, outline: "none",
    cursor: "pointer", fontFamily: "'Georgia', serif",
  },
  clearBtn: {
    background: "transparent", border: `1.5px solid ${P.border}`, borderRadius: 10,
    padding: "10px 18px", fontSize: 16, color: P.muted, cursor: "pointer",
    fontFamily: "'Georgia', serif", whiteSpace: "nowrap",
  },

  // Legend
  legend: { display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  legendItem: { display: "flex", alignItems: "center", gap: 7, fontSize: 16, color: P.muted },
  legendDot: (color, border) => ({
    width: 16, height: 16, borderRadius: 4, background: color,
    border: `1.5px solid ${border}`,
  }),

  // Grid
  gridWrap: { overflowX: "auto", background: P.surface, borderRadius: 16, border: `1.5px solid ${P.border}` },
  table: { borderCollapse: "collapse", width: "100%", minWidth: 700 },
  thTime: {
    width: 130, fontSize: 16, color: P.muted, fontWeight: "bold",
    textTransform: "uppercase", letterSpacing: 1, padding: "16px",
    textAlign: "left", borderBottom: `1.5px solid ${P.border}`,
  },
  thDay: {
    fontSize: 16, fontWeight: "bold", color: P.teal, padding: "16px",
    textAlign: "left", borderBottom: `1.5px solid ${P.border}`, borderLeft: `1.5px solid ${P.border}`
  },
  trSlot: { borderBottom: `1.5px solid ${P.border}` },
  tdTime: {
    padding: "16px", fontSize: 16, fontWeight: "bold", color: P.teal,
    background: P.tealLight, whiteSpace: "nowrap", width: 140,
    verticalAlign: "top",
  },
  tdCell: {
    padding: "12px 16px",
    borderLeft: `1.5px solid ${P.border}`,
    background: P.surface,
    verticalAlign: "top",
  },

  // Slot cell interior
  slotInner: { display: "flex", flexWrap: "wrap", gap: 12, minHeight: 45, alignItems: "center" },

  // Appointment pill
  apptPill: {
    background: P.tealLight, border: `1.5px solid ${P.teal}`,
    borderRadius: 8, padding: "8px 12px", cursor: "pointer",
    transition: "all .15s", minWidth: 160,
  },
  apptName: { fontSize: 16, fontWeight: "bold", color: P.teal },
  apptNota: { fontSize: 16, color: P.muted, marginTop: 2, lineHeight: 1.3 },

  // Empty slot button
  emptySlot: (highlight) => ({
    border: `1.5px dashed ${highlight ? P.availBdr : P.border}`,
    borderRadius: 8, padding: "8px 12px",
    background: highlight ? P.available : "transparent",
    color: highlight ? "#2D7A4A" : P.muted,
    fontSize: 16, cursor: "pointer", textAlign: "center",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "all .15s", minHeight: 38, minWidth: 140,
  }),

  fullTag: {
    background: P.full, border: `1px solid ${P.fullBdr}`,
    borderRadius: 6, padding: "6px 12px", fontSize: 16,
    color: "#B03030", textAlign: "center", fontWeight: "bold",
  },

  // Modal
  overlay: {
    position: "fixed", inset: 0, background: "rgba(43,36,32,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 20,
  },
  modal: {
    background: P.surface, borderRadius: 20, padding: "32px 36px",
    width: "100%", maxWidth: 460, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
    border: `1.5px solid ${P.border}`,
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: P.teal, marginBottom: 4 },
  modalSub: { fontSize: 16, color: P.muted, marginBottom: 24 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 },
  fieldLabel: { fontSize: 16, fontWeight: "bold", color: P.text },
  fieldInput: {
    border: `1.5px solid ${P.border}`, borderRadius: 10, padding: "12px 14px",
    fontSize: 17, background: P.white, color: P.text, outline: "none",
    fontFamily: "'Georgia', serif", transition: "border .15s",
  },
  fieldTextarea: {
    border: `1.5px solid ${P.border}`, borderRadius: 10, padding: "12px 14px",
    fontSize: 16, background: P.white, color: P.text, outline: "none",
    fontFamily: "'Georgia', serif", resize: "vertical", minHeight: 80,
    transition: "border .15s",
  },
  modalBtns: { display: "flex", gap: 12, marginTop: 8 },
  btnPrimary: {
    flex: 1, background: P.teal, color: P.white, border: "none",
    borderRadius: 12, padding: "14px", fontSize: 17, fontWeight: "bold",
    cursor: "pointer", fontFamily: "'Georgia', serif", transition: "background .15s",
  },
  btnSecondary: {
    flex: 1, background: "transparent", color: P.muted,
    border: `1.5px solid ${P.border}`, borderRadius: 12, padding: "14px",
    fontSize: 17, cursor: "pointer", fontFamily: "'Georgia', serif",
  },
  // Detail modal
  detailHeader: { fontSize: 20, fontWeight: "bold", color: P.teal, marginBottom: 6 },
  detailSlot: { fontSize: 16, color: P.muted, marginBottom: 20 },
  detailNota: {
    background: P.tealLight, border: `1px solid ${P.teal}`,
    borderRadius: 10, padding: "12px 14px", fontSize: 16, color: P.text,
    marginBottom: 20, lineHeight: 1.5,
  },
  btnDanger: {
    flex: 1, background: P.terra, color: P.white, border: "none",
    borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: "bold",
    cursor: "pointer", fontFamily: "'Georgia', serif",
  },

  // Badge
  badge: (n, cap) => ({
    display: "inline-block", fontSize: 16, fontWeight: "bold",
    background: n >= cap ? P.full : P.available,
    color: n >= cap ? "#B03030" : "#2D7A4A",
    border: `1px solid ${n >= cap ? P.fullBdr : P.availBdr}`,
    borderRadius: 20, padding: "2px 8px", marginLeft: 6,
    verticalAlign: "middle",
  }),

  toast: {
    position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)",
    background: P.teal, color: P.white, borderRadius: 12, padding: "14px 28px",
    fontSize: 16, fontWeight: "bold", boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    zIndex: 200, pointerEvents: "none",
  },
};

// ── Main Component ─────────────────────────────────────────
export default function KinesiologiaTurnos() {
  // Use a callback to only check localStorage once on mount
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("kidep_auth") === "true";
  });
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [currentDate, setCurrentDate] = useState(TODAY_STR);
  const [appointments, setAppointments] = useState([]);
  const [modal, setModal] = useState(null); // { type: "new"|"detail", date, slot, appt? }
  const [form, setForm] = useState({ nombre: "", apellido: "", nota: "" });
  const [filterName, setFilterName] = useState("");
  const [filterSlot, setFilterSlot] = useState("");
  const [hideOccupied, setHideOccupied] = useState(false);
  const [toast, setToast] = useState("");

  // ── Fetch Appointments ───────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      fetch("http://localhost:3001/appointments")
        .then(res => res.json())
        .then(data => setAppointments(data))
        .catch(err => {
          console.error("Error fetching appointments:", err);
          showToast("❌ Error de conexión con la base de datos");
        });
    }
  }, [isAuthenticated]);

  // ── Auth Logic ───────────────────────────────────────────
  function handleLogin() {
    const validUser = import.meta.env.VITE_USERNAME || "admin";
    const validPass = import.meta.env.VITE_PASSWORD || "kidep123";

    if (loginUser === validUser && loginPass === validPass) {
      setIsAuthenticated(true);
      localStorage.setItem("kidep_auth", "true");
      setLoginError("");
    } else {
      setLoginError("Usuario o contraseña incorrectos");
    }
  }

  // ── Derived ──────────────────────────────────────────────
  const byKey = useMemo(() => {
    const map = {};
    for (const a of appointments) {
      const k = getKey(a.date, a.slot);
      if (!map[k]) map[k] = [];
      map[k].push(a);
    }
    return map;
  }, [appointments]);

  const nameMatch = (a) => {
    if (!filterName.trim()) return true;
    const q = filterName.toLowerCase();
    return a.nombre.toLowerCase().includes(q) || a.apellido.toLowerCase().includes(q);
  };

  // Cells to highlight based on filters (only for the current day)
  const highlightKeys = useMemo(() => {
    const keys = new Set();
    if (!filterSlot && !filterName) return keys;

    for (const slot of SLOTS) {
      const k = getKey(currentDate, slot);
      const appts = byKey[k] || [];
      const available = appts.length < CAPACITY;
      const matchSlot = !filterSlot || slot === filterSlot;
      const matchName = filterName ? appts.some(nameMatch) : true;

      if (filterName && matchName && matchSlot) keys.add(k);
      else if (!filterName && available && matchSlot) keys.add(k);
    }
    return keys;
  }, [filterName, filterSlot, byKey, currentDate]);

  const hasFilters = filterName || filterSlot;

  // ── Actions ──────────────────────────────────────────────
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function openNew(slot) {
    setForm({ nombre: "", apellido: "", nota: "" });
    setModal({ type: "new", date: currentDate, slot });
  }

  function openDetail(appt) {
    setModal({ type: "detail", appt });
  }

  async function saveAppointment() {
    if (!form.nombre.trim() || !form.apellido.trim()) return;
    const newA = {
      date: modal.date, slot: modal.slot,
      nombre: form.nombre.trim(), apellido: form.apellido.trim(), nota: form.nota.trim(),
    };
    
    try {
      const res = await fetch("http://localhost:3001/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newA)
      });
      const data = await res.json();
      setAppointments(prev => [...prev, data]);
      setModal(null);
      showToast("✔ Turno guardado");
    } catch (err) {
      console.error(err);
      showToast("❌ Error al guardar turno");
    }
  }

  async function deleteAppointment(id) {
    try {
      await fetch(`http://localhost:3001/appointments/${id}`, { method: "DELETE" });
      setAppointments(prev => prev.filter(a => a.id !== id));
      setModal(null);
      showToast("Turno eliminado");
    } catch (err) {
      console.error(err);
      showToast("❌ Error al eliminar turno");
    }
  }

  function changeDate(amount) {
    setCurrentDate(prev => addWeekdays(prev, amount));
  }

  function goToToday() {
    setCurrentDate(getTodayWeekday());
  }

  // ── Render helpers ───────────────────────────────────────
  function renderSlot(slot) {
    const k = getKey(currentDate, slot);
    const appts = byKey[k] || [];
    const free = CAPACITY - appts.length;
    const isFull = free === 0;
    const isHighlighted = highlightKeys.has(k);

    const visibleAppts = filterName ? appts.filter(nameMatch) : appts;
    const dimmed = hasFilters && !isHighlighted;

    if (filterName && visibleAppts.length === 0) {
      return null;
    }

    return (
      <tr key={slot} style={{ ...S.trSlot, opacity: dimmed ? 0.3 : 1 }}>
        <td style={S.tdTime}>
          {slotLabel(slot)}
          <div style={{ marginTop: 6 }}>
            <span style={S.badge(appts.length, CAPACITY)}>
              {free} libres
            </span>
          </div>
        </td>
        <td style={S.tdCell}>
          <div style={S.slotInner}>
            {!hideOccupied && visibleAppts.map(a => (
              <div
                key={a.id}
                style={S.apptPill}
                onClick={() => openDetail(a)}
                title="Ver o eliminar turno"
              >
                <div style={S.apptName}>👤 {a.nombre} {a.apellido}</div>
                {a.nota && <div style={S.apptNota}>📝 {a.nota}</div>}
              </div>
            ))}
            {!isFull && !filterName && Array.from({ length: free }).map((_, i) => (
              <button
                key={i}
                style={S.emptySlot(isHighlighted)}
                onClick={() => openNew(slot)}
              >
                ＋ Nuevo turno
              </button>
            ))}
            {isFull && !hideOccupied && <div style={S.fullTag}>🔴 Turno Completo</div>}
          </div>
        </td>
      </tr>
    );
  }

  // ── JSX ──────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...S.modal, width: '100%', maxWidth: 400, margin: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={{ fontSize: 48 }}>🦴</span>
            <h1 style={{ ...S.headerTitle, color: P.teal, marginTop: 16 }}>Kidep - Kinesiología</h1>
            <p style={{ color: P.muted, fontSize: 16, marginTop: 8 }}>Ingreso al sistema de gestión</p>
          </div>
          
          <div style={S.field}>
            <label style={S.fieldLabel}>Usuario</label>
            <input 
              style={S.fieldInput} 
              value={loginUser} 
              onChange={e => setLoginUser(e.target.value)} 
              placeholder="Ej: admin"
              autoFocus
            />
          </div>
          <div style={S.field}>
            <label style={S.fieldLabel}>Contraseña</label>
            <input 
              type="password"
              style={S.fieldInput} 
              value={loginPass} 
              onChange={e => setLoginPass(e.target.value)} 
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          {loginError && <div style={{ color: P.terra, fontSize: 16, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>{loginError}</div>}
          <button style={{ ...S.btnPrimary, width: '100%' }} onClick={handleLogin}>Iniciar Sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {/* ─ Header ─ */}
      <div style={S.header}>
        <span style={S.headerIcon}>🦴</span>
        <div style={{ flex: 1 }}>
          <h1 style={S.headerTitle}>Kidep - Kinesiología</h1>
          <div style={S.headerSub}>Lunes a Viernes · 09:00 – 19:00 hs</div>
        </div>
        <button 
          style={{ ...S.clearBtn, color: P.white, borderColor: 'rgba(255,255,255,0.4)', padding: "8px 16px" }} 
          onClick={() => { 
            setIsAuthenticated(false); 
            localStorage.removeItem("kidep_auth");
            setLoginPass(""); 
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <div style={S.main}>

        {/* ─ Date Navigation ─ */}
        <div style={S.navCard}>
          <button style={S.navBtn} onClick={() => changeDate(-1)}>« Día anterior</button>
          <div style={S.navDate}>{formatDisplayDate(currentDate)}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={{ ...S.navBtn, background: "transparent" }} onClick={goToToday}>Hoy</button>
            <button style={S.navBtn} onClick={() => changeDate(1)}>Día siguiente »</button>
          </div>
        </div>

        {/* ─ Filter bar ─ */}
        <div style={S.filterCard}>
          <div style={S.filterTitle}>🔍 Filtros de Búsqueda</div>
          <div style={S.filterRow}>
            <div style={S.filterGroup}>
              <span style={S.filterLabel}>Buscar paciente (día actual)</span>
              <input
                style={S.filterInput}
                placeholder="Nombre o apellido…"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
              />
            </div>
            <div style={S.filterGroup}>
              <span style={S.filterLabel}>Ver disponibles a las…</span>
              <select
                style={S.filterSelect}
                value={filterSlot}
                onChange={e => setFilterSlot(e.target.value)}
              >
                <option value="">— Todos los horarios —</option>
                {SLOTS.map(s => (
                  <option key={s} value={s}>{slotLabel(s)}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <button style={S.clearBtn} onClick={() => {
                setFilterName(""); setFilterSlot("");
              }}>✕ Limpiar filtros</button>
            )}
            
            <div style={{ ...S.filterGroup, marginLeft: 'auto' }}>
              <button 
                style={{
                  ...S.navBtn,
                  background: hideOccupied ? P.teal : "transparent",
                  color: hideOccupied ? P.white : P.teal,
                  border: `1.5px solid ${P.teal}`
                }} 
                onClick={() => setHideOccupied(!hideOccupied)}
              >
                {hideOccupied ? "✔ Mostrando solo libres" : "👀 Ocultar ocupados"}
              </button>
            </div>
          </div>
          {hasFilters && (
            <div style={{ marginTop: 14, fontSize: 16, color: P.teal, fontWeight: "bold" }}>
              {filterName
                ? `Mostrando resultados de "${filterName}"`
                : `Resaltando disponibilidad a las ${filterSlot}`
              }
              {" "}·{" "}
              <span style={{ color: P.terra }}>
                {highlightKeys.size} espacio{highlightKeys.size !== 1 ? "s" : ""} resaltado{highlightKeys.size !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* ─ Legend ─ */}
        <div style={S.legend}>
          <div style={S.legendItem}>
            <div style={S.legendDot(P.tealLight, P.teal)} />
            Turno ocupado
          </div>
          <div style={S.legendItem}>
            <div style={S.legendDot(P.available, P.availBdr)} />
            Lugar disponible
          </div>
          <div style={S.legendItem}>
            <div style={S.legendDot(P.full, P.fullBdr)} />
            Horario completo
          </div>
          <div style={{ marginLeft: "auto", fontSize: 16, color: P.muted }}>
            Capacidad por bloque:
            <strong style={{ color: P.teal }}> {CAPACITY} pacientes</strong>
          </div>
        </div>

        {/* ─ Grid ─ */}
        <div style={S.gridWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thTime}>Horario</th>
                <th style={S.thDay}>Turnos del {formatDisplayDate(currentDate)}</th>
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(slot => renderSlot(slot))}
            </tbody>
          </table>
        </div>

      </div>

      {/* ─ New appointment modal ─ */}
      {modal?.type === "new" && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>➕ Nuevo turno</div>
            <div style={S.modalSub}>{formatDisplayDate(modal.date)} · {slotLabel(modal.slot)}</div>
            <div style={S.field}>
              <label style={S.fieldLabel}>Nombre *</label>
              <input
                style={S.fieldInput}
                placeholder="Ej: Ana"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>Apellido *</label>
              <input
                style={S.fieldInput}
                placeholder="Ej: García"
                value={form.apellido}
                onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
              />
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>Nota (opcional)</label>
              <textarea
                style={S.fieldTextarea}
                placeholder="Ej: Dolor lumbar, post-operatorio…"
                value={form.nota}
                onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
              />
            </div>
            <div style={S.modalBtns}>
              <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
              <button
                style={{
                  ...S.btnPrimary,
                  opacity: !form.nombre.trim() || !form.apellido.trim() ? 0.5 : 1,
                }}
                onClick={saveAppointment}
                disabled={!form.nombre.trim() || !form.apellido.trim()}
              >
                ✔ Guardar turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─ Detail / delete modal ─ */}
      {modal?.type === "detail" && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.detailHeader}>
              👤 {modal.appt.nombre} {modal.appt.apellido}
            </div>
            <div style={S.detailSlot}>
              📅 {formatDisplayDate(modal.appt.date)} · {slotLabel(modal.appt.slot)}
            </div>
            {modal.appt.nota ? (
              <div style={S.detailNota}>📝 {modal.appt.nota}</div>
            ) : (
              <div style={{ ...S.detailNota, color: P.muted, fontStyle: "italic" }}>
                Sin nota registrada.
              </div>
            )}
            <div style={S.modalBtns}>
              <button style={S.btnSecondary} onClick={() => setModal(null)}>Cerrar</button>
              <button style={S.btnDanger} onClick={() => deleteAppointment(modal.appt.id)}>
                🗑 Eliminar turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─ Toast ─ */}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}
