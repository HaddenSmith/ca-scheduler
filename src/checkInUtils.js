export const CHECK_IN_BUILDINGS = [
  { name: "Cannon Center", code: "CANC" },
  { name: "Hinckley", code: "B" },
  { name: "Chipman", code: "C" },
  { name: "David John", code: "D" },
  { name: "Taylor", code: "E" },
  { name: "Stover", code: "F" },
  { name: "Budge", code: "G" },
  { name: "Merrill", code: "H" },
  { name: "May", code: "I" },
  { name: "Building 9", code: "J" },
];

export function normalizeCheckInBuilding(value, code = "") {
  const nameValue = String(value ?? "").trim().toLowerCase();
  const codeValue = String(code ?? "").trim().toUpperCase();

  return CHECK_IN_BUILDINGS.find((building) => (
    building.name.toLowerCase() === nameValue || building.code === codeValue
  )) ?? null;
}

export function getCheckInLabel(building) {
  const normalized = normalizeCheckInBuilding(building?.name ?? building, building?.code);
  return normalized ? `CI-${normalized.code}` : "Check In";
}

export function isCheckInAutoLabel(value) {
  const label = String(value ?? "").trim();
  return label === "Check In" || CHECK_IN_BUILDINGS.some((building) => label === `CI-${building.code}`);
}
