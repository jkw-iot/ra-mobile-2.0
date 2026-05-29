// ══════════════════════════════════════════════════════════════
// Scenario catalogue — UI metadata for indoor-climate scenarios.
//
// The web app at `../roomalyzer20/src/services/thresholdService.js`
// owns the canonical list (id, group, labelKey, descKey, icon AND
// the scenario's default thresholds). On mobile we deliberately
// MIRROR ONLY the UI-facing metadata here (no threshold defaults
// — those would create two sources of truth). The actual threshold
// values rendered in the scenario detail sheet always come from
// the live `/api/indeklima/thresholds` response.
//
// When the web repo adds a new scenario, regenerate this file
// (the extraction snippet lives in the chat history) and copy
// the matching `sc_*` translation keys into the mobile locale
// files. The `labelKey` / `descKey` values here resolve under
// `indeklima.scenarios.*` in the locale tree.
// ══════════════════════════════════════════════════════════════

export type ScenarioGroup =
  | 'office'
  | 'education'
  | 'health'
  | 'preservation'
  | 'residential'
  | 'commercial'
  | 'food_storage'
  | 'medicine'
  | 'industrial'
  | 'transport';

export interface ScenarioMeta {
  id: string;
  group: ScenarioGroup;
  /** Translation key under `indeklima.scenarios.*`. */
  labelKey: string;
  /** Translation key under `indeklima.scenarios.*`. May be empty. */
  descKey: string;
  /** Bootstrap-Icons name (without the `bi-` prefix). */
  icon: string;
}

export const SCENARIOS: readonly ScenarioMeta[] = [
  { id: 'open-office', group: 'office', labelKey: 'sc_open_office', descKey: 'sc_open_office_desc', icon: 'building' },
  { id: 'private-office', group: 'office', labelKey: 'sc_private_office', descKey: 'sc_private_office_desc', icon: 'person-workspace' },
  { id: 'meeting-room', group: 'office', labelKey: 'sc_meeting_room', descKey: 'sc_meeting_room_desc', icon: 'people' },
  { id: 'call-center', group: 'office', labelKey: 'sc_call_center', descKey: 'sc_call_center_desc', icon: 'headset' },
  { id: 'server-room', group: 'office', labelKey: 'sc_server_room', descKey: 'sc_server_room_desc', icon: 'hdd-rack' },
  { id: 'school', group: 'education', labelKey: 'sc_school', descKey: 'sc_school_desc', icon: 'mortarboard' },
  { id: 'daycare', group: 'education', labelKey: 'sc_daycare', descKey: 'sc_daycare_desc', icon: 'emoji-smile' },
  { id: 'auditorium', group: 'education', labelKey: 'sc_auditorium', descKey: 'sc_auditorium_desc', icon: 'megaphone' },
  { id: 'sports-hall', group: 'education', labelKey: 'sc_sports_hall', descKey: 'sc_sports_hall_desc', icon: 'dribbble' },
  { id: 'hospital', group: 'health', labelKey: 'sc_hospital', descKey: 'sc_hospital_desc', icon: 'hospital' },
  { id: 'laboratory', group: 'health', labelKey: 'sc_laboratory', descKey: 'sc_laboratory_desc', icon: 'eyedropper' },
  { id: 'care-home', group: 'health', labelKey: 'sc_care_home', descKey: 'sc_care_home_desc', icon: 'house-heart' },
  { id: 'dental-clinic', group: 'health', labelKey: 'sc_dental_clinic', descKey: 'sc_dental_clinic_desc', icon: 'clipboard2-pulse' },
  { id: 'historic-church', group: 'preservation', labelKey: 'sc_historic_church', descKey: 'sc_historic_church_desc', icon: 'building-up' },
  { id: 'modern-church', group: 'preservation', labelKey: 'sc_modern_church', descKey: 'sc_modern_church_desc', icon: 'buildings' },
  { id: 'museum-exhibition', group: 'preservation', labelKey: 'sc_museum_exhibition', descKey: 'sc_museum_exhibition_desc', icon: 'easel' },
  { id: 'museum-storage', group: 'preservation', labelKey: 'sc_museum_storage', descKey: 'sc_museum_storage_desc', icon: 'archive' },
  { id: 'archive', group: 'preservation', labelKey: 'sc_archive', descKey: 'sc_archive_desc', icon: 'book' },
  { id: 'cold-art-storage', group: 'preservation', labelKey: 'sc_cold_art_storage', descKey: 'sc_cold_art_storage_desc', icon: 'snow' },
  { id: 'historic-manor', group: 'preservation', labelKey: 'sc_historic_manor', descKey: 'sc_historic_manor_desc', icon: 'bank' },
  { id: 'residential', group: 'residential', labelKey: 'sc_residential', descKey: 'sc_residential_desc', icon: 'house' },
  { id: 'bedroom', group: 'residential', labelKey: 'sc_bedroom', descKey: 'sc_bedroom_desc', icon: 'moon' },
  { id: 'childrens-room', group: 'residential', labelKey: 'sc_childrens_room', descKey: 'sc_childrens_room_desc', icon: 'stars' },
  { id: 'bathroom', group: 'residential', labelKey: 'sc_bathroom', descKey: 'sc_bathroom_desc', icon: 'droplet' },
  { id: 'basement', group: 'residential', labelKey: 'sc_basement', descKey: 'sc_basement_desc', icon: 'box-seam' },
  { id: 'summer-house', group: 'residential', labelKey: 'sc_summer_house', descKey: 'sc_summer_house_desc', icon: 'house-heart' },
  { id: 'retail', group: 'commercial', labelKey: 'sc_retail', descKey: 'sc_retail_desc', icon: 'shop' },
  { id: 'restaurant', group: 'commercial', labelKey: 'sc_restaurant', descKey: 'sc_restaurant_desc', icon: 'cup-hot' },
  { id: 'warehouse', group: 'commercial', labelKey: 'sc_warehouse', descKey: 'sc_warehouse_desc', icon: 'box2' },
  { id: 'fitness', group: 'commercial', labelKey: 'sc_fitness', descKey: 'sc_fitness_desc', icon: 'bicycle' },
  { id: 'food-cold-dk', group: 'food_storage', labelKey: 'sc_food_cold_dk', descKey: 'sc_food_cold_dk_desc', icon: 'flag' },
  { id: 'food-cold-de', group: 'food_storage', labelKey: 'sc_food_cold_de', descKey: 'sc_food_cold_de_desc', icon: 'flag' },
  { id: 'food-cold-se', group: 'food_storage', labelKey: 'sc_food_cold_se', descKey: 'sc_food_cold_se_desc', icon: 'flag' },
  { id: 'food-cold-uk', group: 'food_storage', labelKey: 'sc_food_cold_uk', descKey: 'sc_food_cold_uk_desc', icon: 'flag' },
  { id: 'food-frozen-eu', group: 'food_storage', labelKey: 'sc_food_frozen_eu', descKey: 'sc_food_frozen_eu_desc', icon: 'snow3' },
  { id: 'medicine-room', group: 'medicine', labelKey: 'sc_medicine_room', descKey: 'sc_medicine_room_desc', icon: 'thermometer-half' },
  { id: 'medicine-cool', group: 'medicine', labelKey: 'sc_medicine_cool', descKey: 'sc_medicine_cool_desc', icon: 'box-seam' },
  { id: 'medicine-fridge', group: 'medicine', labelKey: 'sc_medicine_fridge', descKey: 'sc_medicine_fridge_desc', icon: 'snow' },
  { id: 'production-floor', group: 'industrial', labelKey: 'sc_production_floor', descKey: 'sc_production_floor_desc', icon: 'gear-wide-connected' },
  { id: 'clean-room', group: 'industrial', labelKey: 'sc_clean_room', descKey: 'sc_clean_room_desc', icon: 'shield-fill-check' },
  { id: 'pharmaceutical-production', group: 'industrial', labelKey: 'sc_pharma_production', descKey: 'sc_pharma_production_desc', icon: 'droplet-fill' },
  { id: 'printing', group: 'industrial', labelKey: 'sc_printing', descKey: 'sc_printing_desc', icon: 'printer' },
  { id: 'woodworking', group: 'industrial', labelKey: 'sc_woodworking', descKey: 'sc_woodworking_desc', icon: 'tools' },
  { id: 'textile-production', group: 'industrial', labelKey: 'sc_textile', descKey: 'sc_textile_desc', icon: 'grid-3x3' },
  { id: 'electronics-assembly', group: 'industrial', labelKey: 'sc_electronics_assembly', descKey: 'sc_electronics_assembly_desc', icon: 'cpu' },
  { id: 'cold-storage-industrial', group: 'industrial', labelKey: 'sc_cold_storage_industrial', descKey: 'sc_cold_storage_industrial_desc', icon: 'thermometer-low' },
  { id: 'refrigerated-transport', group: 'transport', labelKey: 'sc_refrigerated_transport', descKey: 'sc_refrigerated_transport_desc', icon: 'truck' },
  { id: 'frozen-transport', group: 'transport', labelKey: 'sc_frozen_transport', descKey: 'sc_frozen_transport_desc', icon: 'snow2' },
  { id: 'cargo-container', group: 'transport', labelKey: 'sc_cargo_container', descKey: 'sc_cargo_container_desc', icon: 'box-seam' },
  { id: 'vehicle-storage', group: 'transport', labelKey: 'sc_vehicle_storage', descKey: 'sc_vehicle_storage_desc', icon: 'car-front' },
  { id: 'airport-cargo', group: 'transport', labelKey: 'sc_airport_cargo', descKey: 'sc_airport_cargo_desc', icon: 'airplane' },
  { id: 'pharma-transport', group: 'transport', labelKey: 'sc_pharma_transport', descKey: 'sc_pharma_transport_desc', icon: 'capsule' },
  { id: 'flower-transport', group: 'transport', labelKey: 'sc_flower_transport', descKey: 'sc_flower_transport_desc', icon: 'flower1' },
  { id: 'boat-winter-storage', group: 'transport', labelKey: 'sc_boat_winter_storage', descKey: 'sc_boat_winter_storage_desc', icon: 'life-preserver' },
  { id: 'co-working', group: 'office', labelKey: 'sc_co_working', descKey: 'sc_co_working_desc', icon: 'people' },
  { id: 'reception-lobby', group: 'office', labelKey: 'sc_reception_lobby', descKey: 'sc_reception_lobby_desc', icon: 'door-open' },
  { id: 'hot-desk', group: 'office', labelKey: 'sc_hot_desk', descKey: 'sc_hot_desk_desc', icon: 'laptop' },
  { id: 'university-lab', group: 'education', labelKey: 'sc_university_lab', descKey: 'sc_university_lab_desc', icon: 'eyedropper' },
  { id: 'library', group: 'education', labelKey: 'sc_library', descKey: 'sc_library_desc', icon: 'book' },
  { id: 'operating-room', group: 'health', labelKey: 'sc_operating_room', descKey: 'sc_operating_room_desc', icon: 'hospital' },
  { id: 'pharmacy', group: 'health', labelKey: 'sc_pharmacy', descKey: 'sc_pharmacy_desc', icon: 'prescription2' },
  { id: 'gothic-cathedral', group: 'preservation', labelKey: 'sc_gothic_cathedral', descKey: 'sc_gothic_cathedral_desc', icon: 'building' },
  { id: 'romanesque-church', group: 'preservation', labelKey: 'sc_romanesque_church', descKey: 'sc_romanesque_church_desc', icon: 'building' },
  { id: 'timber-frame-church', group: 'preservation', labelKey: 'sc_timber_frame_church', descKey: 'sc_timber_frame_church_desc', icon: 'house-door' },
  { id: 'castle-museum', group: 'preservation', labelKey: 'sc_castle_museum', descKey: 'sc_castle_museum_desc', icon: 'bank' },
  { id: 'palace-residence', group: 'preservation', labelKey: 'sc_palace_residence', descKey: 'sc_palace_residence_desc', icon: 'bank2' },
  { id: 'wine-cellar-historic', group: 'preservation', labelKey: 'sc_wine_cellar_historic', descKey: 'sc_wine_cellar_historic_desc', icon: 'cup-straw' },
  { id: 'crypt-underground', group: 'preservation', labelKey: 'sc_crypt_underground', descKey: 'sc_crypt_underground_desc', icon: 'bricks' },
  { id: 'bizot-green-2023', group: 'preservation', labelKey: 'sc_bizot_green', descKey: 'sc_bizot_green_desc', icon: 'shield-check' },
  { id: 'attic-room', group: 'residential', labelKey: 'sc_attic_room', descKey: 'sc_attic_room_desc', icon: 'house-up' },
  { id: 'wine-cellar-private', group: 'residential', labelKey: 'sc_wine_cellar_private', descKey: 'sc_wine_cellar_private_desc', icon: 'cup-straw' },
  { id: 'shed-insulated', group: 'residential', labelKey: 'sc_shed_insulated', descKey: 'sc_shed_insulated_desc', icon: 'house-door' },
  { id: 'shed-uninsulated', group: 'residential', labelKey: 'sc_shed_uninsulated', descKey: 'sc_shed_uninsulated_desc', icon: 'houses' },
  { id: 'cinema-theater', group: 'commercial', labelKey: 'sc_cinema_theater', descKey: 'sc_cinema_theater_desc', icon: 'film' },
  { id: 'swimming-pool', group: 'commercial', labelKey: 'sc_swimming_pool', descKey: 'sc_swimming_pool_desc', icon: 'water' },
  { id: 'hotel-room', group: 'commercial', labelKey: 'sc_hotel_room', descKey: 'sc_hotel_room_desc', icon: 'house-heart' },
  { id: 'art-gallery', group: 'commercial', labelKey: 'sc_art_gallery', descKey: 'sc_art_gallery_desc', icon: 'easel' },
  { id: 'data-center', group: 'industrial', labelKey: 'sc_data_center', descKey: 'sc_data_center_desc', icon: 'hdd-rack' },
  { id: 'bakery-production', group: 'industrial', labelKey: 'sc_bakery_production', descKey: 'sc_bakery_production_desc', icon: 'basket2' },
];

const SCENARIOS_BY_ID = new Map<string, ScenarioMeta>(
  SCENARIOS.map((s) => [s.id, s]),
);

/** Look up scenario metadata by id. Returns `null` for unknown ids. */
export function findScenarioById(id: string | null | undefined): ScenarioMeta | null {
  if (!id) return null;
  return SCENARIOS_BY_ID.get(id) ?? null;
}
