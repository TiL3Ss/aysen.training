export const citiesByRegion: Record<string, string[]> = {
  aysen: ["Coyhaique", "Puerto Aysén", "Puerto Cisnes", "Chile Chico", "Cochrane", "Caleta Tortel", "Villa O’Higgins", "Lago Verde", "Río Ibáñez", "Guaitecas"],
  magallanes: ["Punta Arenas", "Puerto Natales", "Porvenir", "Puerto Williams", "Cerro Sombrero", "Puerto Edén"],
  "los-lagos": ["Puerto Montt", "Osorno", "Castro", "Ancud", "Quellón", "Puerto Varas", "Calbuco", "Frutillar", "Chaitén", "Futaleufú", "Hualaihué", "Palena"],
  "los-rios": ["Valdivia", "La Unión", "Río Bueno", "Panguipulli", "Paillaco", "Los Lagos", "Lanco", "Futrono", "Máfil", "Corral", "Lago Ranco"],
  araucania: ["Temuco", "Angol", "Villarrica", "Pucón", "Victoria", "Lautaro", "Nueva Imperial", "Padre Las Casas", "Carahue", "Curacautín", "Lonquimay", "Toltén"],
  nuble: ["Chillán", "San Carlos", "Bulnes", "Yungay", "Quirihue", "Coihueco", "Pinto", "Cobquecura", "El Carmen", "Ninhue", "San Ignacio"],
  biobio: ["Concepción", "Talcahuano", "Los Ángeles", "Coronel", "Chillán Viejo", "Lota", "Penco", "Tomé", "Arauco", "Cañete", "Curanilahue", "Lebu"],
  maule: ["Talca", "Curicó", "Linares", "Constitución", "Cauquenes", "Parral", "Molina", "San Javier", "Teno", "Longaví", "Licantén", "Hualañé"],
  ohiggins: ["Rancagua", "San Fernando", "Rengo", "Santa Cruz", "Pichilemu", "Graneros", "Machalí", "San Vicente", "Requínoa", "Chimbarongo", "Litueche"],
  metropolitana: ["Santiago", "Puente Alto", "Maipú", "La Florida", "Las Condes", "San Bernardo", "Peñalolén", "Pudahuel", "Quilicura", "Melipilla", "Talagante", "Colina", "Buin", "San José de Maipo"],
  valparaiso: ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "San Antonio", "Quillota", "Los Andes", "San Felipe", "La Calera", "Concón", "Casablanca", "Isla de Pascua", "La Ligua"],
  coquimbo: ["La Serena", "Coquimbo", "Ovalle", "Illapel", "Vicuña", "Los Vilos", "Combarbalá", "Andacollo", "Salamanca", "Monte Patria", "Paihuano"],
  atacama: ["Copiapó", "Vallenar", "Caldera", "Chañaral", "Diego de Almagro", "Tierra Amarilla", "Freirina", "Huasco", "Alto del Carmen"],
  antofagasta: ["Antofagasta", "Calama", "Tocopilla", "Mejillones", "Taltal", "San Pedro de Atacama", "Sierra Gorda", "María Elena", "Ollagüe"],
  tarapaca: ["Iquique", "Alto Hospicio", "Pozo Almonte", "Pica", "Huara", "Camiña", "Colchane"],
  arica: ["Arica", "Putre", "Camarones", "General Lagos"],
};

export function citiesForRegion(regionId: string) { return citiesByRegion[regionId] ?? []; }
