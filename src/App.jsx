import { useState, useMemo, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

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

function getUpcomingWeekdays(startDateStr, count) {
  const dates = [];
  let current = startDateStr;
  for (let i = 0; i < count; i++) {
    dates.push(current);
    current = addWeekdays(current, 1);
  }
  return dates;
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
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
  teal:      "#1C5B5C",
  tealLight: "#E6F4F4",
  tealHover: "#124243",
  terra:     "#A64D20",
  terraLt:   "#FAF0EB",
  text:      "#1A1512",
  muted:     "#544B45",
  white:     "#FFFFFF",
  full:      "#FDE8E8",
  fullBdr:   "#E8A9A9",
  available: "#E8F7ED",
  availBdr:  "#7BC89A",
};

// ── Inline styles (Base Desktop) ───────────────────────────
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
    fontSize: 20, fontWeight: "bold", color: P.text, letterSpacing: "0.5px", textTransform: "capitalize"
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

  // Grid
  gridWrap: { overflowX: "auto", background: P.surface, borderRadius: 16, border: `1.5px solid ${P.border}` },
  table: { borderCollapse: "collapse", width: "100%", minWidth: 600 },
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
    background: P.white, 
    border: `1.5px solid ${P.border}`,
    borderLeft: `5px solid ${P.teal}`,
    borderRadius: 8, padding: "8px 12px", cursor: "pointer",
    transition: "all .15s", minWidth: 160, maxWidth: "100%",
    boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
    overflow: "hidden",
  },
  apptName: { fontSize: 16, fontWeight: "bold", color: P.teal, wordBreak: "break-word" },
  apptNota: { fontSize: 16, color: P.muted, marginTop: 2, lineHeight: 1.3, wordBreak: "break-word" },

  // Empty slot button
  emptySlot: {
    border: `1.5px solid #2D7A4A`,
    borderRadius: 8, padding: "12px 14px",
    background: "#D4EEDC",
    color: "#1E5A35",
    fontSize: 16, cursor: "pointer", textAlign: "center",
    fontWeight: "bold",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "all .15s", minHeight: 44, minWidth: 140,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },

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
    maxHeight: "90vh", overflowY: "auto"
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: P.teal, marginBottom: 4 },
  modalSub: { fontSize: 16, color: P.muted, marginBottom: 24 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 },
  fieldLabel: { fontSize: 16, fontWeight: "bold", color: P.text },
  fieldInput: {
    border: `1.5px solid ${P.border}`, borderRadius: 10, padding: "12px 14px",
    fontSize: 16, background: P.white, color: P.text, outline: "none",
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
    borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: "bold",
    cursor: "pointer", fontFamily: "'Georgia', serif", transition: "all .15s",
  },
  btnSecondary: {
    flex: 1, background: "transparent", color: P.muted,
    border: `1.5px solid ${P.border}`, borderRadius: 12, padding: "14px",
    fontSize: 16, cursor: "pointer", fontFamily: "'Georgia', serif", transition: "all .15s",
  },
  // Detail modal
  detailHeader: { fontSize: 20, fontWeight: "bold", color: P.teal, marginBottom: 6 },
  detailSlot: { fontSize: 16, color: P.muted, marginBottom: 20 },
  btnDanger: {
    flex: 1, background: P.terra, color: P.white, border: "none",
    borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: "bold",
    cursor: "pointer", fontFamily: "'Georgia', serif", transition: "all .15s",
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
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("kidep_auth") === "true";
  });
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [currentView, setCurrentView] = useState("calendar"); // "calendar" | "patients"

  const [currentDate, setCurrentDate] = useState(TODAY_STR);
  const [appointments, setAppointments] = useState([]);
  
  // Modal states: null, or { type: "wizard", step, patient, slots, searchTime }, or { type: "detail", appt }, or { type: "patient", patient }
  const [modal, setModal] = useState(null); 
  const [form, setForm] = useState({ nombre: "", apellido: "", obraSocial: "", telefono: "", email: "", nota: "", _patientKey: "" });
  
  const [filterName, setFilterName] = useState("");
  const [filterTimeFrom, setFilterTimeFrom] = useState("");
  const [filterTimeTo, setFilterTimeTo] = useState("");
  const [hideOccupied, setHideOccupied] = useState(false);
  const [toast, setToast] = useState("");

  // Loading and Saving states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Fetch Appointments ───────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      async function fetchAppts() {
        try {
          const querySnapshot = await getDocs(collection(db, "appointments"));
          const data = [];
          querySnapshot.forEach((docSnap) => {
            data.push({ id: docSnap.id, ...docSnap.data() });
          });
          setAppointments(data);
        } catch (err) {
          console.error("Error fetching appointments:", err);
          showToast("❌ Error al conectar con Firebase.");
        } finally {
          setIsLoading(false);
        }
      }
      fetchAppts();
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

  const patientsList = useMemo(() => {
    const map = {};
    appointments.forEach(a => {
      const key = `${a.nombre.trim().toLowerCase()}|${a.apellido.trim().toLowerCase()}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          nombre: a.nombre.trim(),
          apellido: a.apellido.trim(),
          obraSocial: a.obraSocial || "",
          telefono: a.telefono || "",
          email: a.email || "",
          appts: []
        };
      }
      if (a.telefono) map[key].telefono = a.telefono;
      if (a.email) map[key].email = a.email;
      if (a.obraSocial) map[key].obraSocial = a.obraSocial;
      
      map[key].appts.push(a);
    });
    return Object.values(map).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [appointments]);

  const nameMatch = (a) => {
    if (!filterName.trim()) return true;
    const q = filterName.toLowerCase();
    return a.nombre.toLowerCase().includes(q) || a.apellido.toLowerCase().includes(q);
  };

  const hasFilters = filterName || filterTimeFrom || filterTimeTo;

  // ── Actions ──────────────────────────────────────────────
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function openNew(slot = null) {
    if (slot) {
      setModal({
        type: "singleAppt",
        patient: { nombre: "", apellido: "", obraSocial: "", telefono: "", email: "", nota: "" },
        slot: slot,
        date: currentDate
      });
    } else {
      setModal({
        type: "wizard",
        step: 1,
        patient: { nombre: "", apellido: "", obraSocial: "", telefono: "", email: "", nota: "" },
        slots: [],
        searchTime: ""
      });
    }
  }

  function openDetail(appt) {
    setForm({ 
      nombre: appt.nombre, 
      apellido: appt.apellido, 
      obraSocial: appt.obraSocial || "", 
      telefono: appt.telefono || "", 
      email: appt.email || "", 
      nota: appt.nota || "",
      _patientKey: ""
    });
    setModal({ type: "detail", appt });
    setConfirmDelete(false);
  }

  function openPatientDetail(p) {
    setForm({ 
      nombre: p.nombre, apellido: p.apellido, 
      obraSocial: p.obraSocial, telefono: p.telefono, email: p.email,
      nota: "", _patientKey: p.id 
    });
    setModal({ type: "patient", patient: p });
  }

  function openNewForPatient(p) {
    setModal({
      type: "wizard",
      step: 2,
      patient: { 
        nombre: p.nombre, 
        apellido: p.apellido, 
        obraSocial: p.obraSocial || "", 
        telefono: p.telefono || "", 
        email: p.email || "", 
        nota: "" 
      },
      slots: [],
      searchTime: ""
    });
  }

  function openReschedule(appt) {
    setModal({
      type: "wizard",
      step: 2,
      patient: { 
        nombre: appt.nombre, 
        apellido: appt.apellido, 
        obraSocial: appt.obraSocial || "", 
        telefono: appt.telefono || "", 
        email: appt.email || "", 
        nota: appt.nota || "" 
      },
      slots: [],
      searchTime: "",
      oldApptIdToReplace: appt.id
    });
  }

  async function handleDeleteFromProfile(appt) {
    setIsUpdating(true);
    try {
      await deleteDoc(doc(db, "appointments", appt.id));
      setAppointments(prev => prev.filter(a => a.id !== appt.id));
      setModal(m => {
        if (m?.type === "patient") {
          return { ...m, patient: { ...m.patient, appts: m.patient.appts.filter(x => x.id !== appt.id) } };
        }
        return m;
      });
      setConfirmDeleteId(null);
      showToast("Turno eliminado");
    } catch (err) {
      console.error(err);
      showToast("❌ Error al eliminar turno");
    } finally {
      setIsUpdating(false);
    }
  }

  // Detail Modal Actions
  async function updateAppointmentNota() {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const apptRef = doc(db, "appointments", modal.appt.id);
      const trimmedNota = form.nota.trim();
      const trimmedOs = form.obraSocial.trim();
      const trimmedTel = form.telefono.trim();
      const trimmedEmail = form.email.trim();
      await updateDoc(apptRef, { nota: trimmedNota, obraSocial: trimmedOs, telefono: trimmedTel, email: trimmedEmail });
      setAppointments(prev => prev.map(a => 
        a.id === modal.appt.id ? { ...a, nota: trimmedNota, obraSocial: trimmedOs, telefono: trimmedTel, email: trimmedEmail } : a
      ));
      setModal(null);
      showToast("✔ Datos actualizados");
    } catch (err) {
      console.error(err);
      showToast("❌ Error al actualizar datos");
    } finally {
      setIsUpdating(false);
    }
  }

  async function updatePatientData() {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      const apptsToUpdate = appointments.filter(a => 
        `${a.nombre.trim().toLowerCase()}|${a.apellido.trim().toLowerCase()}` === form._patientKey
      );
      
      apptsToUpdate.forEach(a => {
        const ref = doc(db, "appointments", a.id);
        batch.update(ref, {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          obraSocial: form.obraSocial.trim(),
          telefono: form.telefono.trim(),
          email: form.email.trim()
        });
      });
      
      await batch.commit();
      
      setAppointments(prev => prev.map(a => {
        if (`${a.nombre.trim().toLowerCase()}|${a.apellido.trim().toLowerCase()}` === form._patientKey) {
          return { 
            ...a, 
            nombre: form.nombre.trim(), apellido: form.apellido.trim(),
            obraSocial: form.obraSocial.trim(), telefono: form.telefono.trim(), email: form.email.trim() 
          };
        }
        return a;
      }));
      
      setModal(null);
      showToast(`✔ ${apptsToUpdate.length} turnos actualizados`);
    } catch (err) {
      console.error(err);
      showToast("❌ Error al actualizar paciente");
    } finally {
      setIsUpdating(false);
    }
  }

  async function deleteAppointment(id) {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "appointments", id));
      setAppointments(prev => prev.filter(a => a.id !== id));
      setModal(null);
      showToast("Turno eliminado");
    } catch (err) {
      console.error(err);
      showToast("❌ Error al eliminar turno");
    } finally {
      setIsDeleting(false);
    }
  }

  // Wizard Actions
  function handleWizardNext() {
    setModal(m => ({ ...m, step: m.step + 1 }));
  }
  function handleWizardPrev() {
    setModal(m => ({ ...m, step: m.step - 1 }));
  }

  function toggleWizardSlot(date, slot) {
    setModal(m => {
      const exists = m.slots.find(s => s.date === date && s.slot === slot);
      let newSlots;
      if (exists) {
        newSlots = m.slots.filter(s => !(s.date === date && s.slot === slot));
      } else {
        newSlots = [...m.slots, { date, slot }];
      }
      return { ...m, slots: newSlots };
    });
  }

  async function saveWizardAppointments() {
    setIsSaving(true);
    try {
      const promises = modal.slots.map(s => {
        const newA = {
          date: s.date, 
          slot: s.slot,
          nombre: modal.patient.nombre.trim(),
          apellido: modal.patient.apellido.trim(),
          obraSocial: modal.patient.obraSocial.trim(),
          telefono: modal.patient.telefono.trim(),
          email: modal.patient.email.trim(),
          nota: modal.patient.nota.trim(),
        };
        return addDoc(collection(db, "appointments"), newA).then(docRef => ({ id: docRef.id, ...newA }));
      });
      
      if (modal.oldApptIdToReplace) {
        await deleteDoc(doc(db, "appointments", modal.oldApptIdToReplace));
      }
      
      const results = await Promise.all(promises);
      setAppointments(prev => {
        let next = prev;
        if (modal.oldApptIdToReplace) {
          next = next.filter(a => a.id !== modal.oldApptIdToReplace);
        }
        return [...next, ...results];
      });
      
      // WhatsApp Integration
      const tel = modal.patient.telefono.trim();
      if (tel) {
        const sortedSlots = [...modal.slots].sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
        const datesText = sortedSlots.map(s => `- ${formatDisplayDate(s.date)} a las ${s.slot} hs`).join("%0A");
        const message = `Hola ${modal.patient.nombre}, te confirmamos tus turnos en Kidep Kinesiología:%0A%0A${datesText}%0A%0A¡Te esperamos!`;
        const waUrl = `https://wa.me/${tel.replace(/\D/g, '')}?text=${message}`;
        window.open(waUrl, '_blank');
      }

      setModal(null);
      showToast(`✔ ${results.length} turno${results.length !== 1 ? 's' : ''} agendado${results.length !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      showToast("❌ Error al guardar turnos");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSingleAppointment() {
    setIsSaving(true);
    try {
      const newA = {
        date: modal.date,
        slot: modal.slot,
        nombre: modal.patient.nombre.trim(),
        apellido: modal.patient.apellido.trim(),
        obraSocial: modal.patient.obraSocial.trim(),
        telefono: modal.patient.telefono.trim(),
        email: modal.patient.email.trim(),
        nota: modal.patient.nota.trim(),
      };
      const docRef = await addDoc(collection(db, "appointments"), newA);
      const appt = { id: docRef.id, ...newA };
      setAppointments(prev => [...prev, appt]);
      
      const tel = modal.patient.telefono.trim();
      if (tel) {
        const message = `Hola ${modal.patient.nombre}, te confirmamos tu turno en Kidep Kinesiología para el ${formatDisplayDate(modal.date)} a las ${modal.slot} hs.%0A%0A¡Te esperamos!`;
        const waUrl = `https://wa.me/${tel.replace(/\D/g, '')}?text=${message}`;
        window.open(waUrl, '_blank');
      }

      setModal(null);
      showToast(`✔ Turno agendado`);
    } catch (err) {
      console.error(err);
      showToast("❌ Error al guardar turno");
    } finally {
      setIsSaving(false);
    }
  }

  function sendPatientWhatsApp(p) {
    const tel = p.telefono.trim();
    if (!tel) return;
    
    const today = getTodayWeekday();
    const futureAppts = p.appts.filter(a => a.date >= today);
    const sorted = futureAppts.sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
    
    if (sorted.length === 0) {
      showToast("No hay turnos futuros para enviar.");
      return;
    }
    
    const datesText = sorted.map(s => `- ${formatDisplayDate(s.date)} a las ${s.slot} hs`).join("%0A");
    const message = `Hola ${p.nombre}, te enviamos el recordatorio de tus próximos turnos en Kidep Kinesiología:%0A%0A${datesText}%0A%0A¡Te esperamos!`;
    const waUrl = `https://wa.me/${tel.replace(/\D/g, '')}?text=${message}`;
    window.open(waUrl, '_blank');
  }

  function changeDate(amount) {
    setCurrentDate(prev => addWeekdays(prev, amount));
  }

  function goToToday() {
    setCurrentDate(getTodayWeekday());
  }

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (modal?.type === "detail") updateAppointmentNota();
      if (modal?.type === "patient") updatePatientData();
    }
  };

  // ── Render helpers ───────────────────────────────────────
  function renderSlot(slot) {
    if (filterTimeFrom && slot < filterTimeFrom) return null;
    if (filterTimeTo) {
      const endTime = slotLabel(slot).split(' – ')[1];
      if (endTime > filterTimeTo) return null;
    }

    const k = getKey(currentDate, slot);
    const appts = byKey[k] || [];
    const free = CAPACITY - appts.length;
    const isFull = free <= 0;

    const visibleAppts = filterName ? appts.filter(nameMatch) : appts;

    if (filterName && visibleAppts.length === 0) {
      return null;
    }

    return (
      <tr key={slot} style={S.trSlot}>
        <td style={S.tdTime} className="resp-td-time">
          {slotLabel(slot)}
          <div style={{ marginTop: 6 }}>
            <span style={S.badge(appts.length, CAPACITY)} className="resp-badge">
              {free > 0 ? `${free} libres` : "Lleno"}
            </span>
          </div>
        </td>
        <td style={S.tdCell} className="resp-td-cell">
          <div style={S.slotInner} className="resp-slot-inner">
            {!hideOccupied && visibleAppts.map(a => (
              <div
                key={a.id}
                style={S.apptPill}
                className="resp-pill"
                onClick={() => openDetail(a)}
                title="Ver o modificar turno"
              >
                <div style={S.apptName}>👤 {a.nombre} {a.apellido}</div>
                {a.obraSocial && <div style={{...S.apptNota, color: P.teal}}>💳 {a.obraSocial}</div>}
                {a.nota && <div style={S.apptNota}>📝 {a.nota}</div>}
              </div>
            ))}
            {!isFull && !filterName && Array.from({ length: free }).map((_, i) => (
              <div
                key={`free-${i}`}
                style={{ ...S.emptySlot, cursor: "default", borderStyle: "dashed" }}
                className="resp-empty-btn"
              >
                🟢 Libre
              </div>
            ))}
            {isFull && !hideOccupied && <div style={S.fullTag} className="resp-pill">🔴 Turno Completo</div>}
            
            {!filterName && (
              <button
                style={{
                  ...S.btnPrimary,
                  background: free > 0 ? P.teal : "#F59E0B",
                  padding: "10px 18px",
                  minWidth: "auto",
                  flexShrink: 0,
                  marginLeft: "auto",
                  alignSelf: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  fontSize: 16
                }}
                onClick={() => openNew(slot)}
              >
                {free > 0 ? "➕ Turno" : "➕ Sobre Turno"}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // ── JSX ──────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...S.modal, width: '100%', maxWidth: 400, margin: 20 }} className="resp-modal">
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
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }

        /* ── Responsive Mobile & Tablet Rules ── */
        @media (max-width: 820px) {
          .resp-header {
            flex-direction: column !important;
            text-align: center !important;
            padding: 16px !important;
            gap: 16px !important;
          }
          .resp-header > div {
            width: 100% !important;
            justify-content: center !important;
          }
          .resp-header-actions {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .resp-nav-group, .resp-action-group {
            width: 100% !important;
            justify-content: center !important;
          }
          .resp-nav-group > button, .resp-action-group > button {
            flex: 1 !important;
            margin: 0 !important;
            text-align: center !important;
          }
          
          .resp-main {
            padding: 16px 12px !important;
          }

          .resp-nav {
            flex-wrap: wrap !important;
            padding: 16px !important;
          }
          .resp-nav-date {
            width: 100% !important;
            text-align: center !important;
            order: -1 !important;
            margin-bottom: 16px !important;
          }

          .resp-filter {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .resp-filter-group {
            width: 100% !important;
            margin-left: 0 !important;
          }
          .resp-filter-input, .resp-filter-select {
            width: 100% !important;
            min-width: 0 !important;
          }
          .resp-time-range {
            flex-wrap: wrap !important;
            width: 100% !important;
          }
          .resp-time-range > select {
            flex: 1 !important;
          }
          .resp-hide-btn {
            width: 100% !important;
            margin-top: 8px !important;
          }

          .resp-table-wrap {
            border-radius: 12px !important;
          }
          .resp-table {
            min-width: 0 !important;
          }
          .resp-th-time {
            width: 90px !important;
            padding: 16px 12px !important;
          }
          .resp-td-time {
            width: 90px !important;
            padding: 16px 12px !important;
          }
          .resp-td-cell {
            padding: 12px !important;
          }
          .resp-slot-inner {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .resp-pill, .resp-empty-btn {
            min-width: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .resp-badge {
            display: block !important;
            margin-left: 0 !important;
            margin-top: 8px !important;
            text-align: center !important;
          }

          .resp-modal {
            padding: 24px 20px !important;
            margin: 16px !important;
          }
          .resp-modal-btns {
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
      `}</style>
      
      {/* ─ Header ─ */}
      <div style={{ ...S.header, flexWrap: "wrap", justifyContent: "space-between" }} className="resp-header">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={S.headerIcon}>🦴</span>
          <div>
            <h1 style={S.headerTitle}>Kidep - Kinesiología</h1>
            <div style={S.headerSub}>Lunes a Viernes · 09:00 – 19:00 hs</div>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center" }} className="resp-header-actions">
          {/* Navigation group */}
          <div style={{ display: "flex", gap: 8, background: "rgba(0,0,0,0.1)", padding: 6, borderRadius: 12 }} className="resp-nav-group">
            <button 
              style={{ ...S.btnPrimary, background: currentView === "calendar" ? P.white : "transparent", color: currentView === "calendar" ? P.teal : P.white, border: "none", padding: "10px 16px", boxShadow: currentView === "calendar" ? "0 2px 4px rgba(0,0,0,0.1)" : "none" }}
              onClick={() => setCurrentView("calendar")}
            >
              📅 Agenda
            </button>
            <button 
              style={{ ...S.btnPrimary, background: currentView === "patients" ? P.white : "transparent", color: currentView === "patients" ? P.teal : P.white, border: "none", padding: "10px 16px", boxShadow: currentView === "patients" ? "0 2px 4px rgba(0,0,0,0.1)" : "none" }}
              onClick={() => setCurrentView("patients")}
            >
              👥 Pacientes
            </button>
          </div>

          {/* Action group */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }} className="resp-action-group">
            <button 
              style={{ ...S.btnPrimary, background: "#FFD166", color: "#1E5A35", border: "none", padding: "10px 20px", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", fontSize: 16, fontWeight: "bold" }}
              onClick={() => openNew(null)}
            >
              ➕ Ingresar Tratamiento
            </button>

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
        </div>
      </div>

      <div style={S.main} className="resp-main">

        {/* ─ Calendar View ─ */}
        {currentView === "calendar" && (
          <>
            {/* Date Navigation */}
            <div style={S.navCard} className="resp-nav">
              <button style={S.navBtn} onClick={() => changeDate(-1)}>« Anterior</button>
              <div style={S.navDate} className="resp-nav-date">{formatDisplayDate(currentDate)}</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button style={{ ...S.navBtn, background: "transparent" }} onClick={goToToday}>Hoy</button>
                <button style={S.navBtn} onClick={() => changeDate(1)}>Siguiente »</button>
              </div>
            </div>

            {/* Filter bar */}
            <div style={S.filterCard}>
              <div style={S.filterTitle}>🔍 Filtros de Búsqueda</div>
              <div style={S.filterRow} className="resp-filter">
                <div style={S.filterGroup} className="resp-filter-group">
                  <span style={S.filterLabel}>Buscar paciente (día actual)</span>
                  <input
                    style={S.filterInput}
                    className="resp-filter-input"
                    placeholder="Nombre o apellido…"
                    value={filterName}
                    onChange={e => setFilterName(e.target.value)}
                  />
                </div>
                <div style={S.filterGroup} className="resp-filter-group">
                  <span style={S.filterLabel}>Filtrar por horario</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }} className="resp-time-range">
                    <select
                      style={S.filterSelect}
                      className="resp-filter-select"
                      value={filterTimeFrom}
                      onChange={e => {
                        const val = e.target.value;
                        setFilterTimeFrom(val);
                        if (filterTimeTo && val >= filterTimeTo) setFilterTimeTo("");
                      }}
                    >
                      <option value="">— Desde —</option>
                      {SLOTS.map(s => {
                        if (filterTimeTo && s >= filterTimeTo) return null;
                        return <option key={s} value={s}>{s}</option>;
                      })}
                    </select>
                    <span style={{ color: P.muted, fontWeight: "bold" }}>a</span>
                    <select
                      style={S.filterSelect}
                      className="resp-filter-select"
                      value={filterTimeTo}
                      onChange={e => {
                        const val = e.target.value;
                        setFilterTimeTo(val);
                        if (filterTimeFrom && val <= filterTimeFrom) setFilterTimeFrom("");
                      }}
                    >
                      <option value="">— Hasta —</option>
                      {SLOTS.map(s => {
                        const end = slotLabel(s).split(' – ')[1];
                        if (filterTimeFrom && end <= filterTimeFrom) return null;
                        return <option key={end} value={end}>{end}</option>;
                      })}
                    </select>
                  </div>
                </div>
                {hasFilters && (
                  <button style={S.clearBtn} className="resp-hide-btn" onClick={() => {
                    setFilterName(""); setFilterTimeFrom(""); setFilterTimeTo("");
                  }}>✕ Limpiar filtros</button>
                )}
                
                <div style={{ ...S.filterGroup, marginLeft: 'auto' }} className="resp-filter-group">
                  <button 
                    style={{
                      ...S.navBtn,
                      background: hideOccupied ? P.teal : "transparent",
                      color: hideOccupied ? P.white : P.teal,
                      border: `1.5px solid ${P.teal}`
                    }} 
                    className="resp-hide-btn"
                    onClick={() => setHideOccupied(!hideOccupied)}
                  >
                    {hideOccupied ? "✔ Mostrando solo libres" : "👀 Ocultar ocupados"}
                  </button>
                </div>
              </div>
              {hasFilters && (
                <div style={{ marginTop: 14, fontSize: 16, color: P.teal, fontWeight: "bold" }}>
                  Mostrando resultados filtrados
                </div>
              )}
            </div>

            {/* Grid */}
            <div style={S.gridWrap} className="resp-table-wrap">
              <table style={S.table} className="resp-table">
                <thead>
                  <tr>
                    <th style={S.thTime} className="resp-th-time">Horario</th>
                    <th style={S.thDay}>Turnos del {formatDisplayDate(currentDate)}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="2" style={{ padding: "60px 20px", textAlign: "center", color: P.teal }}>
                        <div style={{ fontSize: 32, marginBottom: 12, animation: "pulse 1.5s infinite" }}>⏳</div>
                        <div style={{ fontSize: 18, fontWeight: "bold" }}>Sincronizando con la nube...</div>
                      </td>
                    </tr>
                  ) : (
                    SLOTS.map(slot => renderSlot(slot))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─ Patients View ─ */}
        {currentView === "patients" && (
          <div style={{ ...S.filterCard, marginTop: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
              <div style={{ ...S.filterTitle, margin: 0, fontSize: 20, color: P.teal }}>👥 Directorio de Pacientes ({patientsList.length})</div>
              <input
                style={S.filterInput}
                placeholder="🔍 Buscar por nombre..."
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
              />
            </div>
            
            <div style={{ overflowX: "auto", border: `1px solid ${P.border}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "14px 16px", borderBottom: `2px solid ${P.border}`, color: P.teal, background: P.tealLight }}>Paciente</th>
                    <th style={{ textAlign: "left", padding: "14px 16px", borderBottom: `2px solid ${P.border}`, color: P.teal, background: P.tealLight }}>Contacto</th>
                    <th style={{ textAlign: "center", padding: "14px 16px", borderBottom: `2px solid ${P.border}`, color: P.teal, background: P.tealLight }}>Total Turnos</th>
                  </tr>
                </thead>
                <tbody>
                  {patientsList.filter(p => `${p.nombre} ${p.apellido}`.toLowerCase().includes(filterName.toLowerCase())).map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${P.border}`, cursor: "pointer", transition: "background .15s" }} 
                        onMouseEnter={e => e.currentTarget.style.background = P.available}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        onClick={() => openPatientDetail(p)}
                    >
                      <td style={{ padding: "16px", fontWeight: "bold", color: P.text, fontSize: 16 }}>
                        {p.nombre} {p.apellido}
                        {p.obraSocial && <div style={{ fontSize: 14, color: P.muted, fontWeight: "normal", marginTop: 4 }}>💳 {p.obraSocial}</div>}
                      </td>
                      <td style={{ padding: "16px", fontSize: 16 }}>
                        {p.telefono && <div>📞 {p.telefono}</div>}
                        {p.email && <div style={{ color: P.muted, marginTop: 4 }}>✉ {p.email}</div>}
                        {!p.telefono && !p.email && <span style={{ color: P.muted, fontStyle: "italic" }}>Sin datos de contacto</span>}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center", fontWeight: "bold", color: P.teal, fontSize: 18 }}>
                        {p.appts.length}
                      </td>
                    </tr>
                  ))}
                  {patientsList.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ textAlign: "center", padding: "40px 20px", color: P.muted }}>No hay pacientes registrados aún.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ─ Wizard Modal (Multi-step) ─ */}
      {modal?.type === "wizard" && (
        <div style={S.overlay} onClick={() => { if (!isSaving) setModal(null) }}>
          <div style={S.modal} className="resp-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ ...S.modalTitle, margin: 0 }}>➕ Agendar Tratamiento</h2>
              <div style={{ background: P.tealLight, color: P.teal, fontWeight: "bold", padding: "4px 10px", borderRadius: 20 }}>
                Paso {modal.step} de 3
              </div>
            </div>

            {/* STEP 1: Datos */}
            {modal.step === 1 && (
              <>
                <div style={S.modalSub}>Seleccioná un paciente existente o ingresá los datos de uno nuevo.</div>

                <div style={{ ...S.field, marginBottom: 24, paddingBottom: 20, borderBottom: `1.5px solid ${P.border}` }}>
                  <label style={{...S.fieldLabel, color: P.teal}}>👥 Cargar paciente registrado</label>
                  <select 
                    style={S.filterSelect}
                    onChange={e => {
                      const selectedId = e.target.value;
                      if (!selectedId) {
                        setModal(m => ({ ...m, patient: { nombre: "", apellido: "", obraSocial: "", telefono: "", email: "", nota: "" } }));
                        return;
                      }
                      const p = patientsList.find(x => x.id === selectedId);
                      if (p) {
                        setModal(m => ({ ...m, patient: { nombre: p.nombre, apellido: p.apellido, obraSocial: p.obraSocial || "", telefono: p.telefono || "", email: p.email || "", nota: "" } }));
                      }
                    }}
                  >
                    <option value="">— Paciente nuevo (ingresar manualmente abajo) —</option>
                    {patientsList.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.apellido} {p.obraSocial ? `(${p.obraSocial})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div style={S.field}>
                  <label style={S.fieldLabel}>Nombre *</label>
                  <input style={S.fieldInput} placeholder="Ej: Ana" value={modal.patient.nombre} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, nombre: e.target.value } }))} autoFocus />
                </div>
                <div style={S.field}>
                  <label style={S.fieldLabel}>Apellido *</label>
                  <input style={S.fieldInput} placeholder="Ej: García" value={modal.patient.apellido} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, apellido: e.target.value } }))} />
                </div>
                <div style={S.field}>
                  <label style={S.fieldLabel}>Obra Social</label>
                  <input style={S.fieldInput} placeholder="Ej: OSDE, Swiss Medical..." value={modal.patient.obraSocial} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, obraSocial: e.target.value } }))} />
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ ...S.field, flex: 1, minWidth: 140 }}>
                    <label style={S.fieldLabel}>Teléfono (WhatsApp)</label>
                    <input style={S.fieldInput} placeholder="Ej: 1123456789" type="tel" value={modal.patient.telefono} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, telefono: e.target.value } }))} />
                  </div>
                  <div style={{ ...S.field, flex: 1, minWidth: 140 }}>
                    <label style={S.fieldLabel}>Email</label>
                    <input style={S.fieldInput} placeholder="Ej: ana@mail.com" type="email" value={modal.patient.email} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, email: e.target.value } }))} />
                  </div>
                </div>
                <div style={S.field}>
                  <label style={S.fieldLabel}>Motivo / Diagnóstico</label>
                  <textarea style={S.fieldTextarea} placeholder="Ej: Rehabilitación rodilla..." value={modal.patient.nota} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, nota: e.target.value } }))} />
                </div>
                <div style={S.modalBtns} className="resp-modal-btns">
                  <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
                  <button style={{ ...S.btnPrimary, opacity: (!modal.patient.nombre.trim() || !modal.patient.apellido.trim()) ? 0.5 : 1 }} onClick={handleWizardNext} disabled={!modal.patient.nombre.trim() || !modal.patient.apellido.trim()}>
                    Siguiente: Elegir Turnos »
                  </button>
                </div>
              </>
            )}

            {/* STEP 2: Agenda / Slots */}
            {modal.step === 2 && (
              <>
                <div style={S.modalSub}>Buscá un horario y seleccioná los días deseados.</div>
                
                <div style={{ ...S.field, marginBottom: 24 }}>
                  <label style={S.fieldLabel}>Seleccionar Horario Preferido</label>
                  <select style={S.filterSelect} value={modal.searchTime} onChange={e => setModal(m => ({ ...m, searchTime: e.target.value }))}>
                    <option value="">— Elegir horario —</option>
                    {SLOTS.map(s => <option key={s} value={s}>{slotLabel(s)}</option>)}
                  </select>
                </div>

                {modal.searchTime ? (
                  <div style={{ border: `1.5px solid ${P.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{ background: P.tealLight, padding: "10px 14px", fontWeight: "bold", color: P.teal, borderBottom: `1.5px solid ${P.border}` }}>
                      Próximos días libres a las {modal.searchTime}
                    </div>
                    <div style={{ maxHeight: 220, overflowY: "auto", background: P.white }}>
                      {getUpcomingWeekdays(currentDate, 20).map(d => {
                        const k = getKey(d, modal.searchTime);
                        const appts = byKey[k] || [];
                        const free = CAPACITY - appts.length;
                        const isFull = free <= 0;
                        const isSelected = modal.slots.some(s => s.date === d && s.slot === modal.searchTime);
                        
                        if (isFull && !isSelected) return null;
                        
                        return (
                          <label key={d} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: `1px solid ${P.border}`, cursor: "pointer", background: isSelected ? P.available : "transparent", transition: "all .15s" }}>
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => toggleWizardSlot(d, modal.searchTime)} 
                              style={{ width: 22, height: 22, cursor: "pointer" }} 
                            />
                            <div style={{ flex: 1, fontSize: 16, fontWeight: isSelected ? "bold" : "normal", color: P.text }}>
                              {formatDisplayDate(d)}
                            </div>
                            <div style={{ fontSize: 14, color: isSelected ? "#1E5A35" : P.teal, fontWeight: "bold" }}>
                              {free} libres
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: P.muted, fontStyle: "italic", border: `1.5px dashed ${P.border}`, borderRadius: 10, marginBottom: 16 }}>
                    👆 Por favor, seleccioná un horario arriba para ver los días disponibles.
                  </div>
                )}

                <div style={{ fontSize: 18, fontWeight: "bold", color: P.teal, textAlign: "center", marginBottom: 16 }}>
                  Total seleccionados: {modal.slots.length} turno{modal.slots.length !== 1 ? 's' : ''}
                </div>

                <div style={S.modalBtns} className="resp-modal-btns">
                  <button style={S.btnSecondary} onClick={handleWizardPrev}>« Atrás</button>
                  <button style={{ ...S.btnPrimary, opacity: modal.slots.length === 0 ? 0.5 : 1 }} onClick={handleWizardNext} disabled={modal.slots.length === 0}>
                    Resumen Final »
                  </button>
                </div>
              </>
            )}

            {/* STEP 3: Resumen */}
            {modal.step === 3 && (
              <>
                <div style={S.modalSub}>Revisá que todo esté correcto antes de guardar.</div>
                
                <div style={{ background: P.surface, border: `1.5px solid ${P.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
                  <h3 style={{ margin: "0 0 10px 0", color: P.teal, fontSize: 20 }}>👤 {modal.patient.nombre} {modal.patient.apellido}</h3>
                  {modal.patient.obraSocial && <div style={{ fontSize: 16, marginBottom: 6, color: P.text }}>💳 <strong>{modal.patient.obraSocial}</strong></div>}
                  {modal.patient.nota && <div style={{ fontSize: 16, color: P.muted, wordBreak: "break-word" }}>📝 {modal.patient.nota}</div>}
                </div>
                
                <div style={{ fontWeight: "bold", marginBottom: 10, fontSize: 18, color: P.teal }}>
                  📅 Se agendarán {modal.slots.length} turnos:
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 24, border: `1px solid ${P.border}`, borderRadius: 8, background: P.white }}>
                  {modal.slots.map((s, i) => (
                    <div key={i} style={{ padding: "12px 14px", borderBottom: `1px solid ${P.border}`, fontSize: 16 }}>
                      ✅ {formatDisplayDate(s.date)} · <strong>{s.slot} hs</strong>
                    </div>
                  ))}
                </div>

                <div style={S.modalBtns} className="resp-modal-btns">
                  <button style={{ ...S.btnSecondary, opacity: isSaving ? 0.5 : 1 }} onClick={handleWizardPrev} disabled={isSaving}>« Atrás</button>
                  <button style={{ ...S.btnPrimary, opacity: isSaving ? 0.5 : 1, cursor: isSaving ? 'wait' : 'pointer' }} onClick={saveWizardAppointments} disabled={isSaving}>
                    {isSaving ? "⏳ Guardando todo..." : "✔ Confirmar y Guardar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─ Single Appointment Modal ─ */}
      {modal?.type === "singleAppt" && (
        <div style={S.overlay} onClick={() => { if (!isSaving) setModal(null) }}>
          <div style={S.modal} className="resp-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ ...S.modalTitle, margin: 0 }}>➕ Agendar Turno</h2>
            </div>
            <div style={{ ...S.detailSlot, marginBottom: 16 }}>
              📅 {formatDisplayDate(modal.date)} · {modal.slot} hs
            </div>

            <div style={S.modalSub}>Seleccioná un paciente existente o ingresá los datos de uno nuevo.</div>

            <div style={{ ...S.field, marginBottom: 24, paddingBottom: 20, borderBottom: `1.5px solid ${P.border}` }}>
              <label style={{...S.fieldLabel, color: P.teal}}>👥 Cargar paciente registrado</label>
              <select 
                style={S.filterSelect}
                onChange={e => {
                  const selectedId = e.target.value;
                  if (!selectedId) {
                    setModal(m => ({ ...m, patient: { nombre: "", apellido: "", obraSocial: "", telefono: "", email: "", nota: "" } }));
                    return;
                  }
                  const p = patientsList.find(x => x.id === selectedId);
                  if (p) {
                    setModal(m => ({ ...m, patient: { nombre: p.nombre, apellido: p.apellido, obraSocial: p.obraSocial || "", telefono: p.telefono || "", email: p.email || "", nota: "" } }));
                  }
                }}
              >
                <option value="">— Paciente nuevo (ingresar manualmente abajo) —</option>
                {patientsList.sort((a,b) => a.nombre.localeCompare(b.nombre)).map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.apellido} {p.obraSocial ? `(${p.obraSocial})` : ''}</option>
                ))}
              </select>
            </div>

            <div style={S.field}>
              <label style={S.fieldLabel}>Nombre *</label>
              <input style={S.fieldInput} placeholder="Ej: Ana" value={modal.patient.nombre} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, nombre: e.target.value } }))} autoFocus />
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>Apellido *</label>
              <input style={S.fieldInput} placeholder="Ej: García" value={modal.patient.apellido} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, apellido: e.target.value } }))} />
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>Obra Social</label>
              <input style={S.fieldInput} placeholder="Ej: OSDE..." value={modal.patient.obraSocial} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, obraSocial: e.target.value } }))} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ ...S.field, flex: 1, minWidth: 140 }}>
                <label style={S.fieldLabel}>Teléfono</label>
                <input style={S.fieldInput} placeholder="Ej: 1123456789" type="tel" value={modal.patient.telefono} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, telefono: e.target.value } }))} />
              </div>
              <div style={{ ...S.field, flex: 1, minWidth: 140 }}>
                <label style={S.fieldLabel}>Email</label>
                <input style={S.fieldInput} placeholder="Ej: ana@mail.com" type="email" value={modal.patient.email} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, email: e.target.value } }))} />
              </div>
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>Motivo / Diagnóstico</label>
              <textarea style={S.fieldTextarea} placeholder="Ej: Rehabilitación rodilla..." value={modal.patient.nota} onChange={e => setModal(m => ({ ...m, patient: { ...m.patient, nota: e.target.value } }))} />
            </div>
            <div style={S.modalBtns} className="resp-modal-btns">
              <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
              <button style={{ ...S.btnPrimary, opacity: (!modal.patient.nombre.trim() || !modal.patient.apellido.trim() || isSaving) ? 0.5 : 1, cursor: isSaving ? 'wait' : 'pointer' }} onClick={saveSingleAppointment} disabled={!modal.patient.nombre.trim() || !modal.patient.apellido.trim() || isSaving}>
                {isSaving ? "⏳ Guardando..." : "✔ Confirmar Turno"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─ Detail / delete modal ─ */}
      {modal?.type === "detail" && (
        <div style={S.overlay} onClick={() => { if (!isDeleting && !isUpdating) setModal(null) }}>
          <div style={S.modal} className="resp-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ ...S.detailHeader, margin: 0, fontSize: 20 }}>
                👤 {modal.appt.nombre} {modal.appt.apellido}
              </div>
              {modal.appt.telefono && (
                <a 
                  href={`https://wa.me/${modal.appt.telefono.replace(/\D/g, '')}?text=Hola%20${modal.appt.nombre},%20te%20escribimos%20de%20Kidep%20Kinesiolog%C3%ADa...`}
                  target="_blank" rel="noreferrer"
                  style={{ background: "#25D366", color: "white", padding: "4px 10px", borderRadius: 20, textDecoration: "none", fontSize: 14, fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
            <div style={S.detailSlot}>
              📅 {formatDisplayDate(modal.appt.date)} · {slotLabel(modal.appt.slot)}
            </div>
            
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ ...S.field, flex: 1, minWidth: 140, marginBottom: 0 }}>
                <label style={S.fieldLabel}>Obra Social</label>
                <input
                  style={S.fieldInput}
                  placeholder="Sin obra social..."
                  value={form.obraSocial}
                  onChange={e => setForm(f => ({ ...f, obraSocial: e.target.value }))}
                  disabled={isDeleting || isUpdating}
                  onKeyDown={handleFormKeyDown}
                />
              </div>
              <div style={{ ...S.field, flex: 1, minWidth: 140, marginBottom: 0 }}>
                <label style={S.fieldLabel}>Teléfono</label>
                <input
                  style={S.fieldInput}
                  placeholder="Sin teléfono..."
                  type="tel"
                  value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                  disabled={isDeleting || isUpdating}
                  onKeyDown={handleFormKeyDown}
                />
              </div>
            </div>

            <div style={{ ...S.field, marginBottom: 18 }}>
              <label style={S.fieldLabel}>Email</label>
              <input
                style={S.fieldInput}
                placeholder="Sin email..."
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={isDeleting || isUpdating}
                onKeyDown={handleFormKeyDown}
              />
            </div>

            <div style={S.field}>
              <label style={S.fieldLabel}>Nota / Evolución</label>
              <textarea
                style={S.fieldTextarea}
                placeholder="Sin nota. Escribí acá para agregar detalles..."
                value={form.nota}
                onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                disabled={isDeleting || isUpdating}
                onKeyDown={handleFormKeyDown}
              />
            </div>

            <div style={S.modalBtns} className="resp-modal-btns">
              {form.nota !== (modal.appt.nota || "") || form.obraSocial !== (modal.appt.obraSocial || "") || form.telefono !== (modal.appt.telefono || "") || form.email !== (modal.appt.email || "") ? (
                <button 
                  style={{ ...S.btnPrimary, opacity: isUpdating ? 0.5 : 1, cursor: isUpdating ? 'wait' : 'pointer' }} 
                  onClick={updateAppointmentNota}
                  disabled={isUpdating || isDeleting}
                >
                  {isUpdating ? "⏳ Guardando..." : "✔ Guardar cambios"}
                </button>
              ) : (
                <button 
                  style={{ ...S.btnSecondary, opacity: (isDeleting || isUpdating) ? 0.5 : 1 }} 
                  onClick={() => setModal(null)}
                  disabled={isDeleting || isUpdating}
                >
                  Cerrar
                </button>
              )}
              
              {!confirmDelete ? (
                <button 
                  style={{ ...S.btnDanger, opacity: (isDeleting || isUpdating) ? 0.5 : 1 }} 
                  onClick={() => setConfirmDelete(true)}
                  disabled={isDeleting || isUpdating}
                >
                  🗑 Eliminar turno
                </button>
              ) : (
                <button 
                  style={{ ...S.btnDanger, background: "#8A1C1C", opacity: isDeleting ? 0.5 : 1, cursor: isDeleting ? 'wait' : 'pointer' }} 
                  onClick={() => deleteAppointment(modal.appt.id)}
                  disabled={isDeleting || isUpdating}
                >
                  {isDeleting ? "⏳ Eliminando..." : "⚠ Confirmar eliminación"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─ Patient Detail Modal ─ */}
      {modal?.type === "patient" && (
        <div style={S.overlay} onClick={() => { if (!isUpdating) setModal(null) }}>
          <div style={{ ...S.modal, maxWidth: 650 }} className="resp-modal" onClick={e => e.stopPropagation()}>
            <div style={{ ...S.detailHeader, margin: "0 0 16px 0", fontSize: 24, textAlign: "center" }}>
              👤 Perfil del Paciente
            </div>
            
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ ...S.field, flex: 1, minWidth: 140, marginBottom: 0 }}>
                <label style={S.fieldLabel}>Nombre *</label>
                <input style={S.fieldInput} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} disabled={isUpdating} onKeyDown={handleFormKeyDown} />
              </div>
              <div style={{ ...S.field, flex: 1, minWidth: 140, marginBottom: 0 }}>
                <label style={S.fieldLabel}>Apellido *</label>
                <input style={S.fieldInput} value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} disabled={isUpdating} onKeyDown={handleFormKeyDown} />
              </div>
            </div>

            <div style={{ ...S.field, marginBottom: 12 }}>
              <label style={S.fieldLabel}>Obra Social</label>
              <input style={S.fieldInput} value={form.obraSocial} onChange={e => setForm(f => ({ ...f, obraSocial: e.target.value }))} disabled={isUpdating} onKeyDown={handleFormKeyDown} />
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <div style={{ ...S.field, flex: 1, minWidth: 140, marginBottom: 0 }}>
                <label style={S.fieldLabel}>Teléfono</label>
                <input style={S.fieldInput} value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} disabled={isUpdating} type="tel" onKeyDown={handleFormKeyDown} />
              </div>
              <div style={{ ...S.field, flex: 1, minWidth: 140, marginBottom: 0 }}>
                <label style={S.fieldLabel}>Email</label>
                <input style={S.fieldInput} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={isUpdating} type="email" onKeyDown={handleFormKeyDown} />
              </div>
            </div>

            <div style={{ borderTop: `1.5px solid ${P.border}`, paddingTop: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: "bold", color: P.teal, fontSize: 16 }}>📅 Historial de Turnos ({modal.patient.appts.length})</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button 
                    onClick={() => openNewForPatient(modal.patient)}
                    style={{ background: P.teal, color: "white", padding: "6px 12px", borderRadius: 20, border: "none", fontSize: 14, fontWeight: "bold", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                  >
                    ➕ Agendar Turno
                  </button>
                  {modal.patient.telefono && (
                    <button 
                      onClick={() => sendPatientWhatsApp(modal.patient)}
                      style={{ background: "#25D366", color: "white", padding: "6px 12px", borderRadius: 20, border: "none", fontSize: 14, fontWeight: "bold", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                    >
                      📲 Reenviar Restantes
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto", border: `1px solid ${P.border}`, borderRadius: 8, background: P.white }}>
                {modal.patient.appts.sort((a,b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot)).map((a, i) => {
                  const isPast = a.date < getTodayWeekday();
                  return (
                    <div 
                      key={i} 
                      style={{ padding: "8px 12px", borderBottom: `1px solid ${P.border}`, fontSize: 16, color: isPast ? P.muted : P.text, background: isPast ? P.bg : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
                      onMouseEnter={e => e.currentTarget.style.background = P.available}
                      onMouseLeave={e => e.currentTarget.style.background = isPast ? P.bg : "transparent"}
                    >
                      <span style={{ flex: 1, cursor: "pointer" }} onClick={() => openDetail(a)} title="Ver detalle del turno">{isPast ? "⏳" : "🟢"} {formatDisplayDate(a.date)} a las {a.slot} hs</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button 
                          onClick={() => { setConfirmDeleteId(null); openReschedule(a); }}
                          style={{ background: P.tealLight, color: P.teal, border: `1px solid ${P.teal}`, padding: "6px 10px", borderRadius: 6, fontSize: 13, fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          🔄 Cambiar fecha
                        </button>
                        {confirmDeleteId === a.id ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button 
                              onClick={() => handleDeleteFromProfile(a)}
                              style={{ background: "#8A1C1C", color: "white", border: `1px solid #8A1C1C`, padding: "6px 10px", borderRadius: 6, fontSize: 13, fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              ⚠ Confirmar
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(null)}
                              style={{ background: "transparent", color: P.muted, border: `1px solid ${P.border}`, padding: "6px 10px", borderRadius: 6, fontSize: 13, fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(a.id); }}
                            style={{ background: "#FCE8E8", color: "#B03030", border: `1px solid #B03030`, padding: "6px 10px", borderRadius: 6, fontSize: 13, fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            🗑 Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 13, color: P.muted, marginTop: 6, textAlign: "center", fontStyle: "italic" }}>
                Nota: Modificar el perfil actualizará automáticamente todos estos turnos.
              </div>
            </div>

            <div style={S.modalBtns} className="resp-modal-btns">
              <button style={{ ...S.btnSecondary, opacity: isUpdating ? 0.5 : 1 }} onClick={() => setModal(null)} disabled={isUpdating}>Cerrar</button>
              
              <button 
                style={{ ...S.btnPrimary, opacity: isUpdating ? 0.5 : 1, cursor: isUpdating ? 'wait' : 'pointer' }} 
                onClick={updatePatientData}
                disabled={isUpdating}
              >
                {isUpdating ? "⏳ Actualizando..." : "✔ Guardar Perfil"}
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
