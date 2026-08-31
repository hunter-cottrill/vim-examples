/**
 * The app's controlled data set. Every drug class, ingredient and problem
 * grouping this app can name comes from here — nothing is free text, nothing
 * is model-authored, and nothing is fetched at runtime.
 *
 * COVERAGE IS PARTIAL AND THAT IS SURFACED, NOT HIDDEN. This table covers
 * roughly 60-75% of ambulatory prescription volume by ingredient. Anything
 * outside it becomes an explicit `unrecognized` exclusion the UI lists
 * separately; it is never silently dropped, and it never counts as evidence
 * that a medication or problem is unmatched.
 *
 * A NOTE ON `expectedClassIds`. It is deliberately NOT "guideline first-line
 * therapy". It is "classes a chart carrying this problem commonly shows".
 * This app compares two lists for disagreement; it does not evaluate whether
 * a patient is correctly treated, and the weaker claim is the honest one.
 */

export type TherapeuticClassId = string;

export interface TherapeuticClass {
  id: TherapeuticClassId;
  /** Provider-facing label. */
  label: string;
}

export interface IngredientEntry {
  /** Lowercase generic ingredient name. */
  ingredient: string;
  /** Lowercase brand names and common spellings. */
  aliases: string[];
  /**
   * An ingredient may belong to more than one class. Where a drug is
   * textbook multi-class but the second class would generate noise rather
   * than signal (carvedilol's alpha blockade; aspirin's NSAID activity), it
   * is deliberately listed under its primary class only — flagging every
   * aspirin-plus-ibuprofen chart as an NSAID duplicate is alarm fatigue, not
   * a finding.
   */
  classIds: TherapeuticClassId[];
}

export type ProblemGroupId = string;

export interface ProblemGroup {
  id: ProblemGroupId;
  label: string;
  /** Uppercase ICD-10 prefixes, dots stripped. Matched longest-prefix-first. */
  icd10Prefixes: string[];
  /** Lowercase substrings matched against the description when no code matches. */
  descriptionHints: string[];
  expectedClassIds: TherapeuticClassId[];
}

export const THERAPEUTIC_CLASSES: readonly TherapeuticClass[] = [
  { id: 'statin', label: 'HMG-CoA reductase inhibitor (statin)' },
  { id: 'ace-inhibitor', label: 'ACE inhibitor' },
  { id: 'arb', label: 'Angiotensin II receptor blocker (ARB)' },
  { id: 'beta-blocker', label: 'Beta blocker' },
  { id: 'ccb', label: 'Calcium channel blocker' },
  { id: 'thiazide-diuretic', label: 'Thiazide diuretic' },
  { id: 'loop-diuretic', label: 'Loop diuretic' },
  { id: 'potassium-sparing-diuretic', label: 'Potassium-sparing diuretic' },
  { id: 'alpha-blocker', label: 'Alpha-1 blocker' },
  { id: 'biguanide', label: 'Biguanide' },
  { id: 'sulfonylurea', label: 'Sulfonylurea' },
  { id: 'dpp4-inhibitor', label: 'DPP-4 inhibitor' },
  { id: 'sglt2-inhibitor', label: 'SGLT2 inhibitor' },
  { id: 'glp1-agonist', label: 'GLP-1 receptor agonist' },
  { id: 'insulin', label: 'Insulin' },
  { id: 'ppi', label: 'Proton pump inhibitor' },
  { id: 'h2-blocker', label: 'H2 receptor antagonist' },
  { id: 'ssri', label: 'SSRI antidepressant' },
  { id: 'snri', label: 'SNRI antidepressant' },
  { id: 'tricyclic', label: 'Tricyclic antidepressant' },
  { id: 'benzodiazepine', label: 'Benzodiazepine' },
  { id: 'opioid-analgesic', label: 'Opioid analgesic' },
  { id: 'nsaid', label: 'NSAID' },
  { id: 'inhaled-corticosteroid', label: 'Inhaled corticosteroid' },
  { id: 'saba', label: 'Short-acting beta agonist (inhaled)' },
  { id: 'laba', label: 'Long-acting beta agonist (inhaled)' },
  { id: 'inhaled-anticholinergic', label: 'Inhaled anticholinergic' },
  { id: 'thyroid-hormone', label: 'Thyroid hormone replacement' },
  { id: 'anticoagulant', label: 'Anticoagulant' },
  { id: 'antiplatelet', label: 'Antiplatelet' },
  { id: 'bisphosphonate', label: 'Bisphosphonate' },
  { id: 'antihistamine', label: 'Antihistamine' },
  { id: 'anticonvulsant', label: 'Anticonvulsant' },
  { id: 'antipsychotic', label: 'Antipsychotic' },
  { id: '5-alpha-reductase-inhibitor', label: '5-alpha reductase inhibitor' },
  { id: 'urate-lowering', label: 'Urate-lowering agent' },
  { id: 'systemic-corticosteroid', label: 'Systemic corticosteroid' },
  { id: 'antibiotic', label: 'Antibiotic' },
];

export const INGREDIENTS: readonly IngredientEntry[] = [
  // --- Statins -------------------------------------------------------------
  { ingredient: 'atorvastatin', aliases: ['lipitor'], classIds: ['statin'] },
  { ingredient: 'simvastatin', aliases: ['zocor'], classIds: ['statin'] },
  { ingredient: 'rosuvastatin', aliases: ['crestor'], classIds: ['statin'] },
  { ingredient: 'pravastatin', aliases: ['pravachol'], classIds: ['statin'] },
  { ingredient: 'lovastatin', aliases: ['mevacor'], classIds: ['statin'] },
  { ingredient: 'fluvastatin', aliases: ['lescol'], classIds: ['statin'] },
  { ingredient: 'pitavastatin', aliases: ['livalo'], classIds: ['statin'] },

  // --- ACE inhibitors ------------------------------------------------------
  { ingredient: 'lisinopril', aliases: ['zestril', 'prinivil'], classIds: ['ace-inhibitor'] },
  { ingredient: 'enalapril', aliases: ['vasotec'], classIds: ['ace-inhibitor'] },
  { ingredient: 'ramipril', aliases: ['altace'], classIds: ['ace-inhibitor'] },
  { ingredient: 'benazepril', aliases: ['lotensin'], classIds: ['ace-inhibitor'] },
  { ingredient: 'quinapril', aliases: ['accupril'], classIds: ['ace-inhibitor'] },
  { ingredient: 'captopril', aliases: [], classIds: ['ace-inhibitor'] },
  { ingredient: 'fosinopril', aliases: ['monopril'], classIds: ['ace-inhibitor'] },
  { ingredient: 'perindopril', aliases: ['aceon'], classIds: ['ace-inhibitor'] },

  // --- ARBs ----------------------------------------------------------------
  { ingredient: 'losartan', aliases: ['cozaar'], classIds: ['arb'] },
  { ingredient: 'valsartan', aliases: ['diovan'], classIds: ['arb'] },
  { ingredient: 'irbesartan', aliases: ['avapro'], classIds: ['arb'] },
  { ingredient: 'olmesartan', aliases: ['benicar'], classIds: ['arb'] },
  { ingredient: 'telmisartan', aliases: ['micardis'], classIds: ['arb'] },
  { ingredient: 'candesartan', aliases: ['atacand'], classIds: ['arb'] },

  // --- Beta blockers -------------------------------------------------------
  { ingredient: 'metoprolol', aliases: ['lopressor', 'toprol'], classIds: ['beta-blocker'] },
  { ingredient: 'atenolol', aliases: ['tenormin'], classIds: ['beta-blocker'] },
  { ingredient: 'carvedilol', aliases: ['coreg'], classIds: ['beta-blocker'] },
  { ingredient: 'propranolol', aliases: ['inderal'], classIds: ['beta-blocker'] },
  { ingredient: 'bisoprolol', aliases: ['zebeta'], classIds: ['beta-blocker'] },
  { ingredient: 'nebivolol', aliases: ['bystolic'], classIds: ['beta-blocker'] },
  { ingredient: 'labetalol', aliases: ['trandate'], classIds: ['beta-blocker'] },

  // --- Calcium channel blockers --------------------------------------------
  { ingredient: 'amlodipine', aliases: ['norvasc'], classIds: ['ccb'] },
  { ingredient: 'diltiazem', aliases: ['cardizem', 'tiazac'], classIds: ['ccb'] },
  { ingredient: 'verapamil', aliases: ['calan', 'verelan'], classIds: ['ccb'] },
  { ingredient: 'nifedipine', aliases: ['procardia', 'adalat'], classIds: ['ccb'] },
  { ingredient: 'felodipine', aliases: ['plendil'], classIds: ['ccb'] },
  { ingredient: 'nicardipine', aliases: ['cardene'], classIds: ['ccb'] },

  // --- Diuretics -----------------------------------------------------------
  { ingredient: 'hydrochlorothiazide', aliases: ['hctz', 'microzide'], classIds: ['thiazide-diuretic'] },
  { ingredient: 'chlorthalidone', aliases: ['thalitone'], classIds: ['thiazide-diuretic'] },
  { ingredient: 'indapamide', aliases: ['lozol'], classIds: ['thiazide-diuretic'] },
  { ingredient: 'metolazone', aliases: ['zaroxolyn'], classIds: ['thiazide-diuretic'] },
  { ingredient: 'furosemide', aliases: ['lasix'], classIds: ['loop-diuretic'] },
  { ingredient: 'bumetanide', aliases: ['bumex'], classIds: ['loop-diuretic'] },
  { ingredient: 'torsemide', aliases: ['demadex'], classIds: ['loop-diuretic'] },
  { ingredient: 'spironolactone', aliases: ['aldactone'], classIds: ['potassium-sparing-diuretic'] },
  { ingredient: 'triamterene', aliases: ['dyrenium'], classIds: ['potassium-sparing-diuretic'] },
  { ingredient: 'eplerenone', aliases: ['inspra'], classIds: ['potassium-sparing-diuretic'] },
  { ingredient: 'amiloride', aliases: ['midamor'], classIds: ['potassium-sparing-diuretic'] },

  // --- Diabetes ------------------------------------------------------------
  { ingredient: 'metformin', aliases: ['glucophage', 'fortamet'], classIds: ['biguanide'] },
  { ingredient: 'glipizide', aliases: ['glucotrol'], classIds: ['sulfonylurea'] },
  { ingredient: 'glyburide', aliases: ['diabeta', 'micronase'], classIds: ['sulfonylurea'] },
  { ingredient: 'glimepiride', aliases: ['amaryl'], classIds: ['sulfonylurea'] },
  { ingredient: 'sitagliptin', aliases: ['januvia'], classIds: ['dpp4-inhibitor'] },
  { ingredient: 'linagliptin', aliases: ['tradjenta'], classIds: ['dpp4-inhibitor'] },
  { ingredient: 'saxagliptin', aliases: ['onglyza'], classIds: ['dpp4-inhibitor'] },
  { ingredient: 'alogliptin', aliases: ['nesina'], classIds: ['dpp4-inhibitor'] },
  { ingredient: 'empagliflozin', aliases: ['jardiance'], classIds: ['sglt2-inhibitor'] },
  { ingredient: 'dapagliflozin', aliases: ['farxiga'], classIds: ['sglt2-inhibitor'] },
  { ingredient: 'canagliflozin', aliases: ['invokana'], classIds: ['sglt2-inhibitor'] },
  { ingredient: 'ertugliflozin', aliases: ['steglatro'], classIds: ['sglt2-inhibitor'] },
  { ingredient: 'semaglutide', aliases: ['ozempic', 'wegovy', 'rybelsus'], classIds: ['glp1-agonist'] },
  { ingredient: 'liraglutide', aliases: ['victoza', 'saxenda'], classIds: ['glp1-agonist'] },
  { ingredient: 'dulaglutide', aliases: ['trulicity'], classIds: ['glp1-agonist'] },
  { ingredient: 'exenatide', aliases: ['byetta', 'bydureon'], classIds: ['glp1-agonist'] },
  { ingredient: 'tirzepatide', aliases: ['mounjaro', 'zepbound'], classIds: ['glp1-agonist'] },
  { ingredient: 'insulin glargine', aliases: ['lantus', 'basaglar', 'toujeo'], classIds: ['insulin'] },
  { ingredient: 'insulin lispro', aliases: ['humalog'], classIds: ['insulin'] },
  { ingredient: 'insulin aspart', aliases: ['novolog'], classIds: ['insulin'] },
  { ingredient: 'insulin detemir', aliases: ['levemir'], classIds: ['insulin'] },
  { ingredient: 'insulin degludec', aliases: ['tresiba'], classIds: ['insulin'] },
  { ingredient: 'insulin glulisine', aliases: ['apidra'], classIds: ['insulin'] },
  { ingredient: 'insulin human', aliases: ['humulin', 'novolin'], classIds: ['insulin'] },

  // --- Acid suppression ----------------------------------------------------
  { ingredient: 'omeprazole', aliases: ['prilosec'], classIds: ['ppi'] },
  { ingredient: 'pantoprazole', aliases: ['protonix'], classIds: ['ppi'] },
  { ingredient: 'esomeprazole', aliases: ['nexium'], classIds: ['ppi'] },
  { ingredient: 'lansoprazole', aliases: ['prevacid'], classIds: ['ppi'] },
  { ingredient: 'rabeprazole', aliases: ['aciphex'], classIds: ['ppi'] },
  { ingredient: 'dexlansoprazole', aliases: ['dexilant'], classIds: ['ppi'] },
  { ingredient: 'famotidine', aliases: ['pepcid'], classIds: ['h2-blocker'] },
  { ingredient: 'ranitidine', aliases: ['zantac'], classIds: ['h2-blocker'] },
  { ingredient: 'cimetidine', aliases: ['tagamet'], classIds: ['h2-blocker'] },
  { ingredient: 'nizatidine', aliases: ['axid'], classIds: ['h2-blocker'] },

  // --- Psychiatry ----------------------------------------------------------
  { ingredient: 'sertraline', aliases: ['zoloft'], classIds: ['ssri'] },
  { ingredient: 'fluoxetine', aliases: ['prozac'], classIds: ['ssri'] },
  { ingredient: 'escitalopram', aliases: ['lexapro'], classIds: ['ssri'] },
  { ingredient: 'citalopram', aliases: ['celexa'], classIds: ['ssri'] },
  { ingredient: 'paroxetine', aliases: ['paxil'], classIds: ['ssri'] },
  { ingredient: 'fluvoxamine', aliases: ['luvox'], classIds: ['ssri'] },
  { ingredient: 'venlafaxine', aliases: ['effexor'], classIds: ['snri'] },
  { ingredient: 'duloxetine', aliases: ['cymbalta'], classIds: ['snri'] },
  { ingredient: 'desvenlafaxine', aliases: ['pristiq'], classIds: ['snri'] },
  { ingredient: 'levomilnacipran', aliases: ['fetzima'], classIds: ['snri'] },
  { ingredient: 'amitriptyline', aliases: ['elavil'], classIds: ['tricyclic'] },
  { ingredient: 'nortriptyline', aliases: ['pamelor'], classIds: ['tricyclic'] },
  { ingredient: 'doxepin', aliases: ['silenor'], classIds: ['tricyclic'] },
  { ingredient: 'imipramine', aliases: ['tofranil'], classIds: ['tricyclic'] },
  { ingredient: 'alprazolam', aliases: ['xanax'], classIds: ['benzodiazepine'] },
  { ingredient: 'lorazepam', aliases: ['ativan'], classIds: ['benzodiazepine'] },
  { ingredient: 'clonazepam', aliases: ['klonopin'], classIds: ['benzodiazepine'] },
  { ingredient: 'diazepam', aliases: ['valium'], classIds: ['benzodiazepine'] },
  { ingredient: 'temazepam', aliases: ['restoril'], classIds: ['benzodiazepine'] },
  { ingredient: 'quetiapine', aliases: ['seroquel'], classIds: ['antipsychotic'] },
  { ingredient: 'risperidone', aliases: ['risperdal'], classIds: ['antipsychotic'] },
  { ingredient: 'aripiprazole', aliases: ['abilify'], classIds: ['antipsychotic'] },
  { ingredient: 'olanzapine', aliases: ['zyprexa'], classIds: ['antipsychotic'] },
  { ingredient: 'haloperidol', aliases: ['haldol'], classIds: ['antipsychotic'] },
  { ingredient: 'ziprasidone', aliases: ['geodon'], classIds: ['antipsychotic'] },
  { ingredient: 'lurasidone', aliases: ['latuda'], classIds: ['antipsychotic'] },

  // --- Analgesia -----------------------------------------------------------
  { ingredient: 'oxycodone', aliases: ['oxycontin', 'roxicodone', 'percocet'], classIds: ['opioid-analgesic'] },
  { ingredient: 'hydrocodone', aliases: ['norco', 'vicodin', 'lortab'], classIds: ['opioid-analgesic'] },
  { ingredient: 'morphine', aliases: ['ms contin'], classIds: ['opioid-analgesic'] },
  { ingredient: 'tramadol', aliases: ['ultram'], classIds: ['opioid-analgesic'] },
  { ingredient: 'hydromorphone', aliases: ['dilaudid'], classIds: ['opioid-analgesic'] },
  { ingredient: 'fentanyl', aliases: ['duragesic'], classIds: ['opioid-analgesic'] },
  { ingredient: 'codeine', aliases: [], classIds: ['opioid-analgesic'] },
  { ingredient: 'methadone', aliases: ['dolophine'], classIds: ['opioid-analgesic'] },
  { ingredient: 'buprenorphine', aliases: ['suboxone', 'subutex'], classIds: ['opioid-analgesic'] },
  { ingredient: 'ibuprofen', aliases: ['motrin', 'advil'], classIds: ['nsaid'] },
  { ingredient: 'naproxen', aliases: ['aleve', 'naprosyn'], classIds: ['nsaid'] },
  { ingredient: 'meloxicam', aliases: ['mobic'], classIds: ['nsaid'] },
  { ingredient: 'celecoxib', aliases: ['celebrex'], classIds: ['nsaid'] },
  { ingredient: 'diclofenac', aliases: ['voltaren'], classIds: ['nsaid'] },
  { ingredient: 'indomethacin', aliases: ['indocin'], classIds: ['nsaid'] },
  { ingredient: 'ketorolac', aliases: ['toradol'], classIds: ['nsaid'] },

  // --- Respiratory ---------------------------------------------------------
  { ingredient: 'fluticasone', aliases: ['flovent', 'flonase'], classIds: ['inhaled-corticosteroid'] },
  { ingredient: 'budesonide', aliases: ['pulmicort'], classIds: ['inhaled-corticosteroid'] },
  { ingredient: 'mometasone', aliases: ['asmanex'], classIds: ['inhaled-corticosteroid'] },
  { ingredient: 'beclomethasone', aliases: ['qvar'], classIds: ['inhaled-corticosteroid'] },
  { ingredient: 'ciclesonide', aliases: ['alvesco'], classIds: ['inhaled-corticosteroid'] },
  { ingredient: 'albuterol', aliases: ['proair', 'ventolin', 'proventil'], classIds: ['saba'] },
  { ingredient: 'levalbuterol', aliases: ['xopenex'], classIds: ['saba'] },
  { ingredient: 'salmeterol', aliases: ['serevent'], classIds: ['laba'] },
  { ingredient: 'formoterol', aliases: ['foradil'], classIds: ['laba'] },
  { ingredient: 'vilanterol', aliases: [], classIds: ['laba'] },
  { ingredient: 'indacaterol', aliases: ['arcapta'], classIds: ['laba'] },
  { ingredient: 'tiotropium', aliases: ['spiriva'], classIds: ['inhaled-anticholinergic'] },
  { ingredient: 'ipratropium', aliases: ['atrovent'], classIds: ['inhaled-anticholinergic'] },
  { ingredient: 'umeclidinium', aliases: ['incruse'], classIds: ['inhaled-anticholinergic'] },
  { ingredient: 'aclidinium', aliases: ['tudorza'], classIds: ['inhaled-anticholinergic'] },

  // --- Endocrine / bone ----------------------------------------------------
  { ingredient: 'levothyroxine', aliases: ['synthroid', 'levoxyl', 'unithroid', 'euthyrox'], classIds: ['thyroid-hormone'] },
  { ingredient: 'liothyronine', aliases: ['cytomel'], classIds: ['thyroid-hormone'] },
  { ingredient: 'alendronate', aliases: ['fosamax'], classIds: ['bisphosphonate'] },
  { ingredient: 'risedronate', aliases: ['actonel'], classIds: ['bisphosphonate'] },
  { ingredient: 'ibandronate', aliases: ['boniva'], classIds: ['bisphosphonate'] },
  { ingredient: 'zoledronic acid', aliases: ['reclast'], classIds: ['bisphosphonate'] },

  // --- Haematology ---------------------------------------------------------
  { ingredient: 'warfarin', aliases: ['coumadin', 'jantoven'], classIds: ['anticoagulant'] },
  { ingredient: 'apixaban', aliases: ['eliquis'], classIds: ['anticoagulant'] },
  { ingredient: 'rivaroxaban', aliases: ['xarelto'], classIds: ['anticoagulant'] },
  { ingredient: 'dabigatran', aliases: ['pradaxa'], classIds: ['anticoagulant'] },
  { ingredient: 'edoxaban', aliases: ['savaysa'], classIds: ['anticoagulant'] },
  { ingredient: 'enoxaparin', aliases: ['lovenox'], classIds: ['anticoagulant'] },
  { ingredient: 'clopidogrel', aliases: ['plavix'], classIds: ['antiplatelet'] },
  { ingredient: 'aspirin', aliases: ['acetylsalicylic acid', 'asa'], classIds: ['antiplatelet'] },
  { ingredient: 'ticagrelor', aliases: ['brilinta'], classIds: ['antiplatelet'] },
  { ingredient: 'prasugrel', aliases: ['effient'], classIds: ['antiplatelet'] },
  { ingredient: 'dipyridamole', aliases: ['persantine'], classIds: ['antiplatelet'] },
  { ingredient: 'cilostazol', aliases: ['pletal'], classIds: ['antiplatelet'] },

  // --- Neurology -----------------------------------------------------------
  { ingredient: 'gabapentin', aliases: ['neurontin'], classIds: ['anticonvulsant'] },
  { ingredient: 'pregabalin', aliases: ['lyrica'], classIds: ['anticonvulsant'] },
  { ingredient: 'levetiracetam', aliases: ['keppra'], classIds: ['anticonvulsant'] },
  { ingredient: 'lamotrigine', aliases: ['lamictal'], classIds: ['anticonvulsant'] },
  { ingredient: 'topiramate', aliases: ['topamax'], classIds: ['anticonvulsant'] },
  { ingredient: 'divalproex', aliases: ['depakote', 'valproate', 'valproic acid'], classIds: ['anticonvulsant'] },
  { ingredient: 'carbamazepine', aliases: ['tegretol'], classIds: ['anticonvulsant'] },
  { ingredient: 'phenytoin', aliases: ['dilantin'], classIds: ['anticonvulsant'] },
  { ingredient: 'oxcarbazepine', aliases: ['trileptal'], classIds: ['anticonvulsant'] },

  // --- Allergy -------------------------------------------------------------
  { ingredient: 'cetirizine', aliases: ['zyrtec'], classIds: ['antihistamine'] },
  { ingredient: 'loratadine', aliases: ['claritin'], classIds: ['antihistamine'] },
  { ingredient: 'fexofenadine', aliases: ['allegra'], classIds: ['antihistamine'] },
  { ingredient: 'diphenhydramine', aliases: ['benadryl'], classIds: ['antihistamine'] },
  { ingredient: 'levocetirizine', aliases: ['xyzal'], classIds: ['antihistamine'] },
  { ingredient: 'hydroxyzine', aliases: ['atarax', 'vistaril'], classIds: ['antihistamine'] },

  // --- Urology -------------------------------------------------------------
  { ingredient: 'tamsulosin', aliases: ['flomax'], classIds: ['alpha-blocker'] },
  { ingredient: 'doxazosin', aliases: ['cardura'], classIds: ['alpha-blocker'] },
  { ingredient: 'terazosin', aliases: ['hytrin'], classIds: ['alpha-blocker'] },
  { ingredient: 'alfuzosin', aliases: ['uroxatral'], classIds: ['alpha-blocker'] },
  { ingredient: 'prazosin', aliases: ['minipress'], classIds: ['alpha-blocker'] },
  { ingredient: 'finasteride', aliases: ['proscar', 'propecia'], classIds: ['5-alpha-reductase-inhibitor'] },
  { ingredient: 'dutasteride', aliases: ['avodart'], classIds: ['5-alpha-reductase-inhibitor'] },

  // --- Gout ----------------------------------------------------------------
  { ingredient: 'allopurinol', aliases: ['zyloprim'], classIds: ['urate-lowering'] },
  { ingredient: 'febuxostat', aliases: ['uloric'], classIds: ['urate-lowering'] },
  { ingredient: 'colchicine', aliases: ['colcrys'], classIds: ['urate-lowering'] },
  { ingredient: 'probenecid', aliases: ['benemid'], classIds: ['urate-lowering'] },

  // --- Systemic steroids ---------------------------------------------------
  { ingredient: 'prednisone', aliases: ['deltasone'], classIds: ['systemic-corticosteroid'] },
  { ingredient: 'prednisolone', aliases: ['orapred'], classIds: ['systemic-corticosteroid'] },
  { ingredient: 'methylprednisolone', aliases: ['medrol'], classIds: ['systemic-corticosteroid'] },
  { ingredient: 'dexamethasone', aliases: ['decadron'], classIds: ['systemic-corticosteroid'] },
  { ingredient: 'hydrocortisone', aliases: ['cortef'], classIds: ['systemic-corticosteroid'] },

  // --- Antibiotics ---------------------------------------------------------
  { ingredient: 'amoxicillin', aliases: ['amoxil'], classIds: ['antibiotic'] },
  { ingredient: 'amoxicillin clavulanate', aliases: ['augmentin'], classIds: ['antibiotic'] },
  { ingredient: 'azithromycin', aliases: ['zithromax', 'z pak'], classIds: ['antibiotic'] },
  { ingredient: 'doxycycline', aliases: ['vibramycin'], classIds: ['antibiotic'] },
  { ingredient: 'cephalexin', aliases: ['keflex'], classIds: ['antibiotic'] },
  { ingredient: 'ciprofloxacin', aliases: ['cipro'], classIds: ['antibiotic'] },
  { ingredient: 'levofloxacin', aliases: ['levaquin'], classIds: ['antibiotic'] },
  { ingredient: 'sulfamethoxazole trimethoprim', aliases: ['bactrim', 'septra'], classIds: ['antibiotic'] },
  { ingredient: 'clindamycin', aliases: ['cleocin'], classIds: ['antibiotic'] },
  { ingredient: 'nitrofurantoin', aliases: ['macrobid', 'macrodantin'], classIds: ['antibiotic'] },
  { ingredient: 'metronidazole', aliases: ['flagyl'], classIds: ['antibiotic'] },
  { ingredient: 'penicillin', aliases: [], classIds: ['antibiotic'] },
];

export const PROBLEM_GROUPS: readonly ProblemGroup[] = [
  {
    id: 'type-2-diabetes',
    label: 'Type 2 diabetes mellitus',
    icd10Prefixes: ['E11'],
    descriptionHints: ['type 2 diabetes', 'type ii diabetes', 'diabetes mellitus type 2', 'niddm'],
    expectedClassIds: ['biguanide', 'sulfonylurea', 'dpp4-inhibitor', 'sglt2-inhibitor', 'glp1-agonist', 'insulin'],
  },
  {
    id: 'type-1-diabetes',
    label: 'Type 1 diabetes mellitus',
    icd10Prefixes: ['E10'],
    descriptionHints: ['type 1 diabetes', 'type i diabetes', 'diabetes mellitus type 1', 'iddm'],
    expectedClassIds: ['insulin'],
  },
  {
    id: 'hypertension',
    label: 'Hypertension',
    icd10Prefixes: ['I10', 'I11', 'I12', 'I13', 'I15'],
    descriptionHints: ['hypertension', 'high blood pressure'],
    expectedClassIds: ['ace-inhibitor', 'arb', 'beta-blocker', 'ccb', 'thiazide-diuretic', 'loop-diuretic', 'potassium-sparing-diuretic'],
  },
  {
    id: 'hyperlipidemia',
    label: 'Hyperlipidemia',
    icd10Prefixes: ['E78'],
    descriptionHints: ['hyperlipidemia', 'hypercholesterolemia', 'dyslipidemia', 'high cholesterol'],
    expectedClassIds: ['statin'],
  },
  {
    id: 'hypothyroidism',
    label: 'Hypothyroidism',
    icd10Prefixes: ['E03', 'E02'],
    descriptionHints: ['hypothyroid'],
    expectedClassIds: ['thyroid-hormone'],
  },
  {
    id: 'asthma',
    label: 'Asthma',
    icd10Prefixes: ['J45'],
    descriptionHints: ['asthma'],
    expectedClassIds: ['inhaled-corticosteroid', 'saba', 'laba'],
  },
  {
    id: 'copd',
    label: 'COPD',
    icd10Prefixes: ['J44', 'J43', 'J42'],
    descriptionHints: ['copd', 'chronic obstructive pulmonary', 'emphysema', 'chronic bronchitis'],
    expectedClassIds: ['inhaled-anticholinergic', 'laba', 'inhaled-corticosteroid', 'saba'],
  },
  {
    id: 'gerd',
    label: 'Gastro-esophageal reflux disease',
    icd10Prefixes: ['K21'],
    descriptionHints: ['gerd', 'gastroesophageal reflux', 'gastro-esophageal reflux', 'acid reflux'],
    expectedClassIds: ['ppi', 'h2-blocker'],
  },
  {
    id: 'peptic-ulcer',
    label: 'Peptic ulcer disease',
    icd10Prefixes: ['K25', 'K26', 'K27'],
    descriptionHints: ['peptic ulcer', 'gastric ulcer', 'duodenal ulcer'],
    expectedClassIds: ['ppi', 'h2-blocker'],
  },
  {
    id: 'depression',
    label: 'Depression',
    icd10Prefixes: ['F32', 'F33'],
    descriptionHints: ['depressive disorder', 'depression'],
    expectedClassIds: ['ssri', 'snri', 'tricyclic'],
  },
  {
    id: 'anxiety',
    label: 'Anxiety disorder',
    icd10Prefixes: ['F41', 'F40'],
    descriptionHints: ['anxiety', 'panic disorder'],
    expectedClassIds: ['ssri', 'snri', 'benzodiazepine'],
  },
  {
    id: 'bipolar-disorder',
    label: 'Bipolar disorder',
    icd10Prefixes: ['F31'],
    descriptionHints: ['bipolar'],
    expectedClassIds: ['antipsychotic', 'anticonvulsant'],
  },
  {
    id: 'schizophrenia',
    label: 'Schizophrenia',
    icd10Prefixes: ['F20'],
    descriptionHints: ['schizophrenia', 'schizoaffective'],
    expectedClassIds: ['antipsychotic'],
  },
  {
    id: 'epilepsy',
    label: 'Epilepsy / seizure disorder',
    icd10Prefixes: ['G40'],
    descriptionHints: ['epilepsy', 'seizure disorder'],
    expectedClassIds: ['anticonvulsant'],
  },
  {
    id: 'peripheral-neuropathy',
    label: 'Peripheral neuropathy',
    icd10Prefixes: ['G62', 'G60'],
    descriptionHints: ['peripheral neuropathy', 'polyneuropathy'],
    expectedClassIds: ['anticonvulsant', 'snri', 'tricyclic'],
  },
  {
    id: 'atrial-fibrillation',
    label: 'Atrial fibrillation',
    icd10Prefixes: ['I48'],
    descriptionHints: ['atrial fibrillation', 'atrial flutter', 'afib'],
    expectedClassIds: ['anticoagulant', 'beta-blocker', 'ccb'],
  },
  {
    id: 'heart-failure',
    label: 'Heart failure',
    icd10Prefixes: ['I50'],
    descriptionHints: ['heart failure', 'chf', 'cardiomyopathy'],
    expectedClassIds: ['ace-inhibitor', 'arb', 'beta-blocker', 'loop-diuretic', 'potassium-sparing-diuretic', 'sglt2-inhibitor'],
  },
  {
    id: 'coronary-artery-disease',
    label: 'Coronary artery disease',
    icd10Prefixes: ['I25'],
    descriptionHints: ['coronary artery disease', 'ischemic heart disease', 'angina'],
    expectedClassIds: ['statin', 'antiplatelet', 'beta-blocker'],
  },
  {
    id: 'myocardial-infarction',
    label: 'Myocardial infarction',
    icd10Prefixes: ['I21', 'I22'],
    descriptionHints: ['myocardial infarction', 'heart attack'],
    expectedClassIds: ['statin', 'antiplatelet', 'beta-blocker', 'ace-inhibitor'],
  },
  {
    id: 'stroke',
    label: 'Stroke / cerebrovascular disease',
    icd10Prefixes: ['I63', 'I69', 'Z8673'],
    descriptionHints: ['stroke', 'cerebral infarction', 'cva'],
    expectedClassIds: ['antiplatelet', 'statin', 'anticoagulant'],
  },
  {
    id: 'venous-thromboembolism',
    label: 'Venous thromboembolism',
    icd10Prefixes: ['I82', 'I26'],
    descriptionHints: ['deep vein thrombosis', 'pulmonary embolism', 'venous thromboembolism'],
    expectedClassIds: ['anticoagulant'],
  },
  {
    id: 'atherosclerosis',
    label: 'Atherosclerosis',
    icd10Prefixes: ['I70'],
    descriptionHints: ['atherosclerosis'],
    expectedClassIds: ['statin', 'antiplatelet'],
  },
  {
    id: 'peripheral-vascular-disease',
    label: 'Peripheral vascular disease',
    icd10Prefixes: ['I73'],
    descriptionHints: ['peripheral vascular disease', 'peripheral artery disease'],
    expectedClassIds: ['antiplatelet', 'statin'],
  },
  {
    id: 'osteoporosis',
    label: 'Osteoporosis',
    icd10Prefixes: ['M80', 'M81'],
    descriptionHints: ['osteoporosis'],
    expectedClassIds: ['bisphosphonate'],
  },
  {
    id: 'osteoarthritis',
    label: 'Osteoarthritis',
    icd10Prefixes: ['M15', 'M16', 'M17', 'M18', 'M19'],
    descriptionHints: ['osteoarthritis', 'degenerative joint disease'],
    expectedClassIds: ['nsaid'],
  },
  {
    id: 'rheumatoid-arthritis',
    label: 'Rheumatoid arthritis',
    icd10Prefixes: ['M05', 'M06'],
    descriptionHints: ['rheumatoid arthritis'],
    expectedClassIds: ['nsaid', 'systemic-corticosteroid'],
  },
  {
    id: 'gout',
    label: 'Gout',
    icd10Prefixes: ['M10', 'M1A'],
    descriptionHints: ['gout'],
    expectedClassIds: ['urate-lowering', 'nsaid', 'systemic-corticosteroid'],
  },
  {
    id: 'benign-prostatic-hyperplasia',
    label: 'Benign prostatic hyperplasia',
    icd10Prefixes: ['N40'],
    descriptionHints: ['benign prostatic hyperplasia', 'prostatic hypertrophy'],
    expectedClassIds: ['alpha-blocker', '5-alpha-reductase-inhibitor'],
  },
  {
    id: 'allergic-rhinitis',
    label: 'Allergic rhinitis',
    icd10Prefixes: ['J30'],
    descriptionHints: ['allergic rhinitis', 'hay fever'],
    expectedClassIds: ['antihistamine'],
  },
  {
    id: 'chronic-kidney-disease',
    label: 'Chronic kidney disease',
    icd10Prefixes: ['N18'],
    descriptionHints: ['chronic kidney disease', 'renal insufficiency'],
    expectedClassIds: ['ace-inhibitor', 'arb', 'loop-diuretic', 'sglt2-inhibitor'],
  },
  {
    id: 'chronic-pain',
    label: 'Chronic pain',
    icd10Prefixes: ['G89', 'M54'],
    descriptionHints: ['chronic pain', 'low back pain', 'dorsalgia'],
    expectedClassIds: ['nsaid', 'opioid-analgesic', 'anticonvulsant'],
  },
  {
    id: 'migraine',
    label: 'Migraine',
    icd10Prefixes: ['G43'],
    descriptionHints: ['migraine'],
    expectedClassIds: ['nsaid', 'beta-blocker', 'anticonvulsant'],
  },
  {
    id: 'insomnia',
    label: 'Insomnia',
    icd10Prefixes: ['G470', 'F510'],
    descriptionHints: ['insomnia'],
    expectedClassIds: ['benzodiazepine', 'antihistamine'],
  },
  {
    id: 'obesity',
    label: 'Obesity',
    icd10Prefixes: ['E66'],
    descriptionHints: ['obesity'],
    expectedClassIds: ['glp1-agonist'],
  },
  {
    id: 'essential-tremor',
    label: 'Essential tremor',
    icd10Prefixes: ['G250'],
    descriptionHints: ['essential tremor'],
    expectedClassIds: ['beta-blocker'],
  },
  {
    id: 'urinary-tract-infection',
    label: 'Urinary tract infection',
    icd10Prefixes: ['N390'],
    descriptionHints: ['urinary tract infection'],
    expectedClassIds: ['antibiotic'],
  },
  {
    id: 'pneumonia',
    label: 'Pneumonia',
    icd10Prefixes: ['J18', 'J15', 'J13'],
    descriptionHints: ['pneumonia'],
    expectedClassIds: ['antibiotic'],
  },
  {
    id: 'cellulitis',
    label: 'Cellulitis',
    icd10Prefixes: ['L03'],
    descriptionHints: ['cellulitis'],
    expectedClassIds: ['antibiotic'],
  },
  {
    id: 'sinusitis',
    label: 'Sinusitis',
    icd10Prefixes: ['J01', 'J32'],
    descriptionHints: ['sinusitis'],
    expectedClassIds: ['antibiotic'],
  },
  {
    id: 'acute-bronchitis',
    label: 'Bronchitis',
    icd10Prefixes: ['J20', 'J40', 'J41'],
    descriptionHints: ['bronchitis'],
    expectedClassIds: ['antibiotic', 'saba'],
  },
];
