const PHONE_ROLE_PREFIXES = {
  primary: "OC",
  backup: "BOC",
};

export function getPhoneCoverageRoles(shift, additionalRoles = []) {
  const roles = [...additionalRoles];

  if (shift.alsoOnCall) {
    roles.push("primary");
  }

  if (shift.alsoBackupOnCall) {
    roles.push("backup");
  }

  return [...new Set(roles.filter((role) => PHONE_ROLE_PREFIXES[role]))];
}

export function getShiftLabelWithPhoneCoverage(shift, { additionalRoles = [], baseLabel } = {}) {
  const label = baseLabel ?? shift.label?.trim() ?? shift.shiftType ?? shift.name ?? "Shift";
  const prefixes = getPhoneCoverageRoles(shift, additionalRoles)
    .map((role) => PHONE_ROLE_PREFIXES[role]);

  return prefixes.length ? `${prefixes.join(" / ")} / ${label}` : label;
}
