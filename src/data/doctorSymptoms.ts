// Auto-generated from doctors_complete_reference.md
// Maps specialty keywords (lowercase) to symptom choices shown to patients

export interface SpecialtySymptoms {
  label: string;
  keywords: string[];
  symptoms: string[];
}

export const SPECIALTY_SYMPTOMS: SpecialtySymptoms[] = [
  {
    label: "General Practitioner / Family Physician",
    keywords: ["general", "gp", "family", "primary care"],
    symptoms: [
      "Fever", "Cough", "Cold / Runny nose", "Fatigue / Weakness",
      "Headache", "Body aches", "Sore throat", "Vomiting", "Diarrhea",
      "Skin rash", "Weight changes", "Mild chest pain",
      "Routine checkup / Health screening", "Vaccination",
      "Prescription renewal", "Referral needed",
    ],
  },
  {
    label: "Internist",
    keywords: ["internist", "internal medicine"],
    symptoms: [
      "Unexplained weight loss", "Persistent fatigue", "Body swelling",
      "Shortness of breath", "High blood pressure", "Elevated blood sugar",
      "Abdominal pain", "Thyroid concern", "Chronic kidney issue",
      "Multiple chronic disease management",
    ],
  },
  {
    label: "Pediatrician / Child Specialist",
    keywords: ["pediatric", "paediatric", "child", "children", "kids", "infant", "baby"],
    symptoms: [
      "Fever in child", "Skin rash in child", "Poor growth / Low weight",
      "Ear pain", "Cough in child", "Vomiting in infant",
      "Delayed development / Milestones concern", "Excessive crying",
      "Child immunization / Vaccination", "School health clearance",
      "Childhood asthma", "ADHD concern", "Jaundice in newborn",
      "Tonsillitis", "Febrile seizures",
    ],
  },
  {
    label: "Geriatrician / Elderly Care",
    keywords: ["geriatric", "geriatrician", "elderly", "old age", "senior"],
    symptoms: [
      "Memory loss / Forgetfulness", "Frequent falls", "Confusion",
      "Urinary incontinence", "Multiple medication side effects", "Frailty",
      "Poor appetite", "Dementia concern", "Parkinson's symptoms",
      "Osteoporosis / Bone weakness", "Depression in elderly",
      "Pressure sores", "Hip fracture follow-up",
    ],
  },
  {
    label: "Cardiologist / Heart Specialist",
    keywords: ["cardio", "cardiologist", "heart", "cardiac"],
    symptoms: [
      "Chest pain", "Palpitations / Irregular heartbeat", "Shortness of breath on exertion",
      "Leg swelling", "Dizziness / Lightheadedness", "Fainting episode",
      "High blood pressure", "ECG / Echo follow-up", "Cholesterol management",
      "Post heart attack care", "Arrhythmia", "Heart failure follow-up",
    ],
  },
  {
    label: "Cardiac / Heart Surgeon",
    keywords: ["cardiac surgeon", "heart surgeon", "cardiovascular surgeon"],
    symptoms: [
      "Severe chest pain", "Blocked coronary arteries", "Valve failure",
      "Aortic aneurysm", "Bypass surgery (CABG) consultation",
      "Valve repair / replacement", "Congenital heart defect",
    ],
  },
  {
    label: "Vascular Surgeon",
    keywords: ["vascular"],
    symptoms: [
      "Leg pain while walking", "Cold limbs", "Leg ulcers",
      "Bulging / Varicose veins", "Sudden arm or leg pain",
      "Deep vein thrombosis", "Carotid artery concern",
    ],
  },
  {
    label: "Neurologist / Brain & Nerve Specialist",
    keywords: ["neuro", "neurologist", "brain", "nerve", "nervous"],
    symptoms: [
      "Headaches / Migraines", "Seizures / Epilepsy", "Numbness or tingling",
      "Weakness in limbs", "Memory loss", "Tremors",
      "Balance problems", "Sudden confusion", "Vision changes",
      "Slurred speech", "Stroke follow-up", "Parkinson's",
    ],
  },
  {
    label: "Neurosurgeon",
    keywords: ["neurosurgeon", "brain surgeon", "spine surgeon"],
    symptoms: [
      "Severe head injury", "Disc herniation / Slip disc pain",
      "Brain tumor symptoms", "Spinal cord compression",
      "Hydrocephalus", "Brain aneurysm",
    ],
  },
  {
    label: "Psychiatrist / Mental Health",
    keywords: ["psychiatr", "mental health", "psycho"],
    symptoms: [
      "Persistent sadness / Depression", "Mood swings", "Hallucinations",
      "Paranoia", "Suicidal thoughts (urgent)", "Panic attacks",
      "Inability to sleep / Insomnia", "Aggression / Behavioral issues",
      "OCD / Compulsions", "Flashbacks / PTSD", "Anxiety disorder",
      "Eating disorder concern", "ADHD (adult)",
    ],
  },
  {
    label: "Addiction Medicine",
    keywords: ["addiction", "de-addiction", "rehabilitation", "rehab"],
    symptoms: [
      "Alcohol dependence", "Drug craving / Withdrawal",
      "Failed attempts to quit smoking or alcohol",
      "Social or work dysfunction from substance use",
      "Opioid dependence", "Tobacco dependence",
    ],
  },
  {
    label: "Pulmonologist / Lung Specialist",
    keywords: ["pulmon", "lung", "respiratory", "chest", "breathing"],
    symptoms: [
      "Chronic cough", "Wheezing", "Shortness of breath",
      "Coughing blood", "Night sweats", "Low oxygen levels",
      "Snoring / Sleep apnea", "Asthma", "COPD follow-up",
      "TB / Tuberculosis", "Lung infection / Pneumonia",
    ],
  },
  {
    label: "Gastroenterologist / Digestive Specialist",
    keywords: ["gastro", "digestive", "stomach", "gi", "gut", "liver", "hepato"],
    symptoms: [
      "Abdominal pain", "Bloating", "Acid reflux / Heartburn",
      "Black or bloody stool", "Chronic diarrhea", "Constipation",
      "Difficulty swallowing", "Jaundice", "Nausea and vomiting",
      "Peptic ulcer", "IBS / Crohn's / Colitis", "Colonoscopy / Endoscopy",
      "Liver disease follow-up", "Hepatitis", "Gallstone symptoms",
    ],
  },
  {
    label: "Endocrinologist / Hormone Specialist",
    keywords: ["endocrin", "hormone", "diabetes", "thyroid", "diabetologist"],
    symptoms: [
      "Uncontrolled diabetes", "Thyroid swelling / Goiter",
      "Unexplained weight gain or loss", "Excessive thirst or urination",
      "Hormonal imbalance", "PCOS", "Adrenal gland concern",
      "Growth hormone disorder", "Osteoporosis",
    ],
  },
  {
    label: "Nephrologist / Kidney Specialist",
    keywords: ["nephro", "kidney", "renal"],
    symptoms: [
      "Decreased urine output", "Swelling in legs / face",
      "High creatinine / Kidney function concern", "Blood in urine",
      "Chronic kidney disease follow-up", "Dialysis related",
      "Recurrent kidney infections", "Kidney stone follow-up",
    ],
  },
  {
    label: "Urologist",
    keywords: ["urolog", "urine", "urinary", "prostate", "bladder"],
    symptoms: [
      "Frequent urination", "Burning during urination",
      "Blood in urine", "Prostate enlargement concern",
      "Kidney stone", "Bladder problem", "Male infertility",
      "Erectile dysfunction", "Urinary tract infection (recurrent)",
    ],
  },
  {
    label: "Gynecologist / Obstetrician",
    keywords: ["gynec", "gynaec", "obstet", "women", "pregnancy", "maternity", "prenatal", "antenatal"],
    symptoms: [
      "Irregular periods", "Heavy bleeding", "Pelvic pain",
      "Pregnancy checkup / Antenatal", "Vaginal discharge / Infection",
      "PCOS", "Menopause symptoms", "Fertility concern",
      "Ovarian cyst", "Fibroids", "Pap smear / Cervical screening",
      "Post-delivery follow-up",
    ],
  },
  {
    label: "Orthopedic / Bone & Joint Specialist",
    keywords: ["ortho", "bone", "joint", "spine", "fracture", "musculo"],
    symptoms: [
      "Knee pain", "Back pain / Lower back pain", "Shoulder pain",
      "Fracture / Broken bone", "Joint swelling", "Slip disc",
      "Sports injury", "Hip pain", "Neck pain",
      "Arthritis", "Ligament / Tendon injury", "Post-surgery follow-up",
    ],
  },
  {
    label: "Dermatologist / Skin Specialist",
    keywords: ["dermat", "skin", "hair", "nail"],
    symptoms: [
      "Acne / Pimples", "Skin rash / Allergy", "Itching",
      "Eczema / Psoriasis", "Skin infection / Fungal",
      "Hair fall / Alopecia", "Nail problem", "Warts / Moles",
      "Pigmentation / Dark spots", "Urticaria / Hives",
      "Dry or oily skin concern",
    ],
  },
  {
    label: "Ophthalmologist / Eye Specialist",
    keywords: ["ophthal", "eye", "vision", "retina", "ocular"],
    symptoms: [
      "Blurred vision", "Eye pain or redness", "Watery / Dry eyes",
      "Spectacle / Lens prescription", "Cataract concern",
      "Glaucoma follow-up", "Retina issue", "Eye infection / Conjunctivitis",
      "Double vision", "Night blindness",
    ],
  },
  {
    label: "ENT Specialist (Ear, Nose, Throat)",
    keywords: ["ent", "ear", "nose", "throat", "otolaryn"],
    symptoms: [
      "Ear pain / Hearing loss", "Ear discharge", "Tinnitus / Ringing in ears",
      "Nasal blockage / Sinusitis", "Nosebleed", "Sore throat / Tonsillitis",
      "Hoarseness / Voice change", "Difficulty swallowing",
      "Vertigo / Dizziness", "Snoring / Sleep apnea",
      "Adenoid / Polyp concern",
    ],
  },
  {
    label: "Dentist / Oral & Maxillofacial",
    keywords: ["dent", "oral", "tooth", "teeth", "maxillofacial"],
    symptoms: [
      "Toothache", "Gum bleeding / Swelling", "Tooth sensitivity",
      "Broken / Chipped tooth", "Dental checkup / Cleaning",
      "Tooth extraction", "Cavity / Decay", "Bad breath",
      "Jaw pain / TMJ", "Teeth alignment / Braces",
      "Wisdom tooth", "Implant consultation",
    ],
  },
  {
    label: "Rheumatologist / Arthritis & Autoimmune",
    keywords: ["rheumat", "arthritis", "autoimmune", "lupus"],
    symptoms: [
      "Joint pain and swelling (multiple joints)", "Morning stiffness",
      "Rheumatoid arthritis follow-up", "Lupus symptoms",
      "Gout / High uric acid", "Dry eyes and mouth",
      "Muscle weakness", "Sjogren's / Scleroderma concern",
    ],
  },
  {
    label: "Oncologist / Cancer Specialist",
    keywords: ["oncolog", "cancer", "tumor", "chemo", "radiation"],
    symptoms: [
      "Unexplained lump or swelling", "Sudden weight loss",
      "Persistent fatigue", "Blood in stool or urine",
      "Chemotherapy follow-up", "Radiation therapy follow-up",
      "Cancer screening / Second opinion", "Post-surgery oncology care",
    ],
  },
  {
    label: "Hematologist / Blood Specialist",
    keywords: ["hematol", "haematol", "blood disorder", "anemia", "leukemia"],
    symptoms: [
      "Anemia / Low hemoglobin", "Abnormal blood counts",
      "Easy bruising or bleeding", "Blood clot / DVT",
      "Sickle cell concern", "Leukemia / Lymphoma follow-up",
      "Bone marrow concern", "Bleeding disorder",
    ],
  },
  {
    label: "Allergist / Immunologist",
    keywords: ["allerg", "immunolog"],
    symptoms: [
      "Seasonal allergies / Hay fever", "Food allergy reaction",
      "Skin allergy / Hives", "Asthma (allergic)",
      "Drug allergy", "Recurrent infections",
      "Immune deficiency concern", "Anaphylaxis history",
    ],
  },
  {
    label: "Physiotherapist / Rehabilitation",
    keywords: ["physio", "rehabilitation", "rehab", "physiother"],
    symptoms: [
      "Post-surgery rehabilitation", "Back or neck pain",
      "Stroke recovery / Paralysis", "Sports injury recovery",
      "Joint stiffness", "Balance and gait problem",
      "Muscle weakness / Atrophy", "Cerebral palsy rehab",
    ],
  },
  {
    label: "Pain Management",
    keywords: ["pain management", "pain specialist"],
    symptoms: [
      "Chronic back pain", "Nerve pain / Burning sensation",
      "Post-surgery pain", "Cancer pain",
      "Fibromyalgia", "Complex regional pain syndrome",
      "Chronic headaches", "Sciatica",
    ],
  },
  {
    label: "Infectious Disease Specialist",
    keywords: ["infectious", "infection", "tropical", "hiv", "tb"],
    symptoms: [
      "Persistent fever", "Swollen lymph nodes",
      "Rash with fever", "Night sweats",
      "Recurrent infections", "Travel illness",
      "HIV / AIDS follow-up", "TB follow-up",
      "Dengue / Malaria / Typhoid", "Sepsis follow-up",
    ],
  },
  {
    label: "Sleep Medicine",
    keywords: ["sleep"],
    symptoms: [
      "Loud snoring", "Stopping breathing during sleep",
      "Excessive daytime sleepiness", "Difficulty falling asleep",
      "Restless legs at night", "Waking unrefreshed",
      "Narcolepsy concern",
    ],
  },
  {
    label: "Neonatologist / Newborn Care",
    keywords: ["neonatal", "neonatolog", "newborn", "premature"],
    symptoms: [
      "Premature birth care", "Low birth weight",
      "Breathing difficulty in newborn", "Jaundice in newborn",
      "Feeding difficulty", "Seizures in newborn",
      "Bluish skin in newborn",
    ],
  },
];

/**
 * Match a doctor's specialty string to symptom options.
 * Returns the matched SpecialtySymptoms or null if no match.
 */
export function getSymptomsForSpecialty(specialty: string): SpecialtySymptoms | null {
  const lower = specialty.toLowerCase();
  return (
    SPECIALTY_SYMPTOMS.find((s) =>
      s.keywords.some((k) => lower.includes(k))
    ) ?? null
  );
}
