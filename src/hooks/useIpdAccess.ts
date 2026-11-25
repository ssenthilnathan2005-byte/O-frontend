import usePermissions from "./usePermissions";

export const IPD_SUBS = ["ipd_bed_requests", "ipd_collections", "ipd_patient_ops", "ipd_patient_billing"] as const;

// Which parts of the IPD / Inward page this login may use.
// An IPD / Inward permission saved before sub-permissions existed (no sub keys at all) means all of them.
export default function useIpdAccess() {
  const { modules, loading } = usePermissions();
  const legacy = modules.includes("ipd") && !IPD_SUBS.some((s) => modules.includes(s));
  const can = (k: string) => modules.includes(k) || legacy;
  const patientOps = can("ipd_patient_ops");
  const patientBilling = can("ipd_patient_billing");
  return {
    ready: !loading,
    bedRequests: can("ipd_bed_requests"),
    collections: can("ipd_collections"),
    patientOps,
    patientBilling,
    patients: patientOps || patientBilling, // the Inward Patients list shows if either is ticked
  };
}
