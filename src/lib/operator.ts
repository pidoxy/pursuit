/** Who runs this deployment. Set these for a public launch; the legal pages read them. */
export const OPERATOR = {
  name: process.env.OPERATOR_NAME || "The operator of this Pursuit instance",
  contact: process.env.CONTACT_EMAIL || null,
  effective: process.env.POLICY_DATE || "5 November 2026",
};
