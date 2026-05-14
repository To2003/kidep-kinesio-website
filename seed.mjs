const PROJECT_ID = "kidep-ba8ae";
const URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/appointments`;

const nombres = ["Mateo", "Ana", "Carlos", "Sofia", "Lucia", "Joaquin", "Valeria", "Tomas", "Martin", "Julieta", "Diego", "Valentina", "Camila", "Bruno", "Emma"];
const apellidos = ["Aguilar", "Gomez", "Perez", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Gonzalez", "Romero", "Sosa", "Torres", "Ruiz", "Silva", "Navarro"];
const notas = ["Dolor lumbar", "Post-operatorio rodilla", "Rehabilitación de hombro", "Esguince de tobillo", "Contractura cervical", "Tendinitis", "Desgarro isquiotibial", "", "", "", "Kinesio respiratoria", "Control post-alta"];

function getYYYYMMDD(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"];

const appointments = [];
const generatedKeys = new Set(); // To prevent exactly identical slots with too many people

for (let i = 0; i < 45; i++) {
  // Distribute over today + next 4 weekdays
  const dateStr = getYYYYMMDD(Math.floor(Math.random() * 5)); 
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const nombre = nombres[Math.floor(Math.random() * nombres.length)];
  const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
  const nota = notas[Math.floor(Math.random() * notas.length)];

  const key = `${dateStr}::${slot}`;
  // Count how many are in this slot
  const count = appointments.filter(a => a.dateStr === dateStr && a.slot === slot).length;
  if (count >= 3) {
    i--; // try again
    continue;
  }

  appointments.push({
    dateStr,
    slot,
    payload: {
      fields: {
        date: { stringValue: dateStr },
        slot: { stringValue: slot },
        nombre: { stringValue: nombre },
        apellido: { stringValue: apellido },
        nota: { stringValue: nota }
      }
    }
  });
}

async function seed() {
  console.log(`🚀 Generando ${appointments.length} turnos ficticios en Firebase...`);
  let success = 0;
  for (const appt of appointments) {
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appt.payload)
      });
      if (!res.ok) {
        console.error("❌ Error adding doc:", await res.text());
      } else {
        success++;
      }
    } catch (e) {
      console.error(e);
    }
  }
  console.log(`✅ ¡Completado! Se agregaron ${success} turnos exitosamente.`);
}

seed();
