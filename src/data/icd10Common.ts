export type Icd10Entry = { code: string; name: string };

const LIST: [string, string][] = [
  ["R50.9", "Fever, unspecified"], ["J06.9", "Acute upper respiratory infection"], ["J00", "Common cold (acute nasopharyngitis)"],
  ["J02.9", "Acute pharyngitis"], ["J03.9", "Acute tonsillitis"], ["J01.9", "Acute sinusitis"], ["J18.9", "Pneumonia"],
  ["J20.9", "Acute bronchitis"], ["J45.9", "Asthma"], ["J44.9", "COPD"], ["J30.4", "Allergic rhinitis"], ["J11.1", "Influenza"],
  ["U07.1", "COVID-19"], ["R05", "Cough"], ["A09", "Infectious gastroenteritis and colitis"], ["R19.7", "Diarrhoea"],
  ["A90", "Dengue fever"], ["A91", "Dengue haemorrhagic fever"], ["B54", "Malaria, unspecified"], ["A01.0", "Typhoid fever"],
  ["A15.9", "Respiratory tuberculosis"], ["B34.9", "Viral infection, unspecified"], ["B19.9", "Viral hepatitis, unspecified"],
  ["B01.9", "Chickenpox"], ["B05.9", "Measles"], ["B26.9", "Mumps"],
  ["E11.9", "Type 2 diabetes mellitus"], ["E10.9", "Type 1 diabetes mellitus"], ["R73.9", "Hyperglycaemia"],
  ["I10", "Essential hypertension"], ["R03.0", "Elevated blood pressure reading"], ["I20.9", "Angina pectoris"],
  ["I25.9", "Chronic ischaemic heart disease"], ["I50.9", "Heart failure"], ["E78.5", "Hyperlipidaemia"], ["I83.9", "Varicose veins of lower limbs"],
  ["E03.9", "Hypothyroidism"], ["E66.9", "Obesity"], ["D50.9", "Iron deficiency anaemia"], ["D64.9", "Anaemia, unspecified"],
  ["E55.9", "Vitamin D deficiency"], ["K29.7", "Gastritis"], ["K21.9", "Gastro-oesophageal reflux disease"], ["K30", "Dyspepsia"],
  ["K59.0", "Constipation"], ["K52.9", "Non-infective gastroenteritis and colitis"], ["K76.0", "Fatty liver"], ["R10.4", "Abdominal pain"],
  ["R11", "Nausea and vomiting"], ["N39.0", "Urinary tract infection"], ["N20.0", "Kidney stone"],
  ["L30.9", "Dermatitis, unspecified"], ["L20.9", "Atopic dermatitis"], ["L50.9", "Urticaria"], ["B35.9", "Dermatophytosis (fungal skin infection)"],
  ["B86", "Scabies"], ["L70.0", "Acne vulgaris"], ["L02.9", "Skin abscess / boil"],
  ["M54.5", "Low back pain"], ["M54.2", "Neck pain (cervicalgia)"], ["M25.5", "Joint pain"], ["M17.9", "Knee osteoarthritis"],
  ["M19.9", "Osteoarthritis, unspecified"], ["M79.1", "Myalgia (muscle pain)"], ["S93.4", "Ankle sprain"],
  ["G43.9", "Migraine"], ["G44.2", "Tension-type headache"], ["R51", "Headache"], ["R42", "Dizziness"], ["R07.4", "Chest pain"],
  ["R53", "Malaise and fatigue"], ["H10.9", "Conjunctivitis"], ["H66.9", "Otitis media"], ["H60.9", "Otitis externa"],
  ["K02.9", "Dental caries"], ["K04.7", "Dental abscess"], ["F41.9", "Anxiety disorder"], ["F32.9", "Depressive episode"], ["G47.0", "Insomnia"],
  ["Z34.9", "Normal pregnancy supervision"], ["N76.0", "Acute vaginitis"], ["N94.6", "Dysmenorrhoea"], ["N92.6", "Irregular menstruation"],
  ["T78.4", "Allergy, unspecified"], ["Z00.0", "General medical examination"], ["Z23", "Immunization"],
];

export const ICD10_COMMON: Icd10Entry[] = LIST.map(([code, name]) => ({ code, name }));

export function searchIcd10(q: string, limit = 8): Icd10Entry[] {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  return ICD10_COMMON.filter(e => e.name.toLowerCase().includes(s) || e.code.toLowerCase().startsWith(s)).slice(0, limit);
}
