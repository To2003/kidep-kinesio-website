const PROJECT_ID = "kidep-ba8ae";
const URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/appointments`;

async function clear() {
  console.log("🚀 Obteniendo todos los turnos para eliminarlos...");
  
  try {
    // Get all documents
    const res = await fetch(URL + "?pageSize=1000"); // assuming less than 1000
    if (!res.ok) {
      console.error("❌ Error fetching docs:", await res.text());
      return;
    }
    
    const data = await res.json();
    const docs = data.documents;
    
    if (!docs || docs.length === 0) {
      console.log("✅ No hay turnos para borrar. La base de datos ya está limpia.");
      return;
    }
    
    console.log(`Encontrados ${docs.length} turnos. Procediendo a eliminar...`);
    
    let deleted = 0;
    for (const doc of docs) {
      // doc.name is something like projects/kidep-ba8ae/databases/(default)/documents/appointments/ID
      const docUrl = `https://firestore.googleapis.com/v1/${doc.name}`;
      
      const delRes = await fetch(docUrl, {
        method: "DELETE"
      });
      
      if (delRes.ok) {
        deleted++;
      } else {
        console.error("Error al borrar:", doc.name);
      }
    }
    
    console.log(`✅ ¡Completado! Se borraron ${deleted} turnos exitosamente.`);
    
  } catch (err) {
    console.error("Error:", err);
  }
}

clear();
