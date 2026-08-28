import type { ProcedureCode } from '../types';

/**
 * Bundled procedure crosswalk — the SDK's Order entity carries only free-text
 * orderName/reason, never a CPT code (see build plan §0). Deliberately limited
 * to DI (imaging) and PROCEDURE order types: LAB and RX orders use different
 * code systems (LOINC/NDC) and are out of scope for v1 (see build plan §9).
 *
 * MRI cervical-spine and MRI lumbar-spine share enough alias overlap with a
 * generic "MRI spine" order to deliberately produce an `ambiguous` crosswalk
 * match — this is intentional test surface, not a data bug.
 */
export const PROCEDURES: ProcedureCode[] = [
  {
    cpt: '70551',
    description: 'MRI brain without contrast',
    aliases: ['mri brain', 'brain mri', 'mri head', 'mri of the brain'],
    orderType: 'DI',
  },
  {
    cpt: '72148',
    description: 'MRI lumbar spine without contrast',
    aliases: ['mri lumbar spine', 'lumbar spine mri', 'mri low back', 'mri spine lumbar'],
    orderType: 'DI',
  },
  {
    cpt: '72141',
    description: 'MRI cervical spine without contrast',
    aliases: ['mri cervical spine', 'cervical spine mri', 'mri neck spine', 'mri spine cervical'],
    orderType: 'DI',
  },
  {
    cpt: '73721',
    description: 'MRI lower extremity joint (knee) without contrast',
    aliases: ['mri knee', 'knee mri'],
    orderType: 'DI',
  },
  {
    cpt: '70450',
    description: 'CT head without contrast',
    aliases: ['ct head', 'ct brain', 'ct scan head', 'head ct'],
    orderType: 'DI',
  },
  {
    cpt: '74177',
    description: 'CT abdomen and pelvis with contrast',
    aliases: ['ct abdomen and pelvis', 'ct abdomen pelvis', 'ct scan abdomen'],
    orderType: 'DI',
  },
  {
    cpt: '71271',
    description: 'Low-dose CT lung cancer screening',
    aliases: ['low dose ct lung', 'lung cancer screening ct', 'ldct lung'],
    orderType: 'DI',
  },
  {
    cpt: '29881',
    description: 'Knee arthroscopy with meniscectomy',
    aliases: ['knee arthroscopy', 'arthroscopic meniscectomy', 'meniscectomy knee'],
    orderType: 'PROCEDURE',
  },
  {
    cpt: '27447',
    description: 'Total knee arthroplasty',
    aliases: ['total knee arthroplasty', 'total knee replacement', 'tka'],
    orderType: 'PROCEDURE',
  },
  {
    cpt: '63030',
    description: 'Lumbar discectomy',
    aliases: ['lumbar discectomy', 'microdiscectomy lumbar', 'disc excision lumbar'],
    orderType: 'PROCEDURE',
  },
  {
    cpt: '43644',
    description: 'Laparoscopic gastric bypass',
    aliases: ['gastric bypass', 'roux-en-y gastric bypass', 'bariatric bypass surgery'],
    orderType: 'PROCEDURE',
  },
  {
    cpt: '95810',
    description: 'Polysomnography (sleep study), attended',
    aliases: ['sleep study', 'polysomnography', 'attended sleep study'],
    orderType: 'PROCEDURE',
  },
  {
    cpt: '64483',
    description: 'Lumbar epidural steroid injection',
    aliases: ['epidural steroid injection', 'lumbar esi', 'epidural injection lumbar'],
    orderType: 'PROCEDURE',
  },
  {
    cpt: '20610',
    description: 'Major joint injection (e.g. knee or shoulder)',
    aliases: ['joint injection', 'knee injection', 'shoulder injection', 'major joint aspiration'],
    orderType: 'PROCEDURE',
  },
  {
    cpt: '93000',
    description: 'Electrocardiogram (12-lead) with interpretation',
    aliases: ['ekg', 'ecg', 'electrocardiogram'],
    orderType: 'PROCEDURE',
  },
];
