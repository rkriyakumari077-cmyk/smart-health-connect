// Knowledge base for the rule-based AI Health Assistant.
// Everything the assistant "knows" lives in this file, so it is easy to read,
// explain in a viva, and extend. Aliases include common Hinglish words so
// patients can type the way they speak ("bukhar aur sar dard").

// ---------- Symptoms ----------
// [code, display name, body system, aliases, isRedFlag]
const SYMPTOMS = [
  // General
  ['fever', 'Fever', 'general', ['fever', 'feverish', 'temperature', 'bukhar', 'bukhaar', 'bukhar hai']],
  ['high_fever', 'High fever (above 102°F)', 'general', ['high fever', 'very high fever', 'high temperature', 'tez bukhar', 'bahut tez bukhar']],
  ['chills', 'Chills / shivering', 'general', ['chills', 'shivering', 'rigors', 'kapkapi', 'thand lag rahi']],
  ['fatigue', 'Tiredness / weakness', 'general', ['fatigue', 'tired', 'tiredness', 'weakness', 'weak', 'exhausted', 'low energy', 'thakan', 'thakaan', 'kamzori']],
  ['body_ache', 'Body ache', 'general', ['body ache', 'body pain', 'bodyache', 'muscle pain', 'muscle ache', 'badan dard', 'sharir dard']],
  ['sweating', 'Sweating', 'general', ['sweating', 'sweats', 'night sweats', 'pasina', 'paseena']],
  ['weight_loss', 'Unexplained weight loss', 'general', ['weight loss', 'losing weight', 'vajan kam', 'wajan kam']],
  ['weight_gain', 'Weight gain', 'general', ['weight gain', 'gaining weight', 'vajan badh', 'wajan badh']],
  ['loss_appetite', 'Loss of appetite', 'general', ['loss of appetite', 'no appetite', 'not hungry', 'bhook nahi', 'bhookh nahi']],
  ['excess_thirst', 'Excessive thirst', 'general', ['excessive thirst', 'very thirsty', 'always thirsty', 'thirsty all the time', 'zyada pyaas', 'bahut pyaas']],
  ['cold_intolerance', 'Feeling cold easily', 'general', ['cold intolerance', 'always feel cold', 'feel cold easily', 'always cold']],
  ['pale_skin', 'Pale skin', 'general', ['pale skin', 'pale', 'paleness', 'looking pale']],
  ['hair_loss', 'Hair loss', 'general', ['hair loss', 'hair fall', 'hairfall', 'baal gir', 'baal jhad']],
  ['dehydration', 'Very little urine / dry mouth', 'general', ['dehydration', 'dehydrated', 'dry mouth', 'very little urine', 'no urine', 'sunken eyes']],

  // Head & nerves
  ['headache', 'Headache', 'neuro', ['headache', 'head ache', 'head pain', 'head is paining', 'sar dard', 'sir dard', 'sirdard', 'sardard']],
  ['one_sided_headache', 'One-sided / throbbing headache', 'neuro', ['one sided headache', 'one-sided headache', 'throbbing headache', 'migraine', 'half head pain', 'aadha sir dard', 'adha sar dard']],
  ['light_sensitivity', 'Sensitivity to light', 'neuro', ['sensitive to light', 'light sensitivity', 'photophobia', 'light hurts my eyes']],
  ['dizziness', 'Dizziness', 'neuro', ['dizziness', 'dizzy', 'giddiness', 'giddy', 'lightheaded', 'light headed', 'vertigo', 'chakkar', 'chakkar aa rahe']],
  ['eye_pain', 'Pain behind the eyes', 'neuro', ['pain behind eyes', 'pain behind the eyes', 'pain behind my eyes', 'behind eye pain', 'aankh ke peeche dard']],
  ['neck_stiffness', 'Stiff neck', 'neuro', ['stiff neck', 'neck stiffness', 'neck is stiff', 'gardan akad']],
  ['confusion', 'Confusion / unusual drowsiness', 'neuro', ['confusion', 'confused', 'disoriented', 'unusually drowsy', 'not responding', 'not making sense'], true],
  ['fainting', 'Fainting', 'neuro', ['fainted', 'fainting', 'passed out', 'unconscious', 'blacked out', 'behosh', 'behoshi'], true],
  ['stroke_signs', 'Weakness on one side / slurred speech', 'neuro', ['weakness on one side', 'one side weakness', 'face drooping', 'face droop', 'slurred speech', 'numbness on one side', 'cannot move arm', "can't move my arm", 'paralysis', 'lakwa'], true],
  ['seizure', 'Seizure / fits', 'neuro', ['seizure', 'seizures', 'fits', 'convulsion', 'convulsions', 'mirgi'], true],

  // Breathing, ear, nose, throat
  ['cough', 'Cough', 'respiratory', ['cough', 'coughing', 'khansi', 'khaansi', 'khasi']],
  ['sore_throat', 'Sore throat', 'ent', ['sore throat', 'throat pain', 'throat infection', 'painful throat', 'gala dard', 'gale mein dard', 'gala kharab']],
  ['runny_nose', 'Runny nose', 'ent', ['runny nose', 'running nose', 'nose running', 'naak beh', 'naak se paani', 'zukam', 'zukaam', 'jukam']],
  ['blocked_nose', 'Blocked nose', 'ent', ['blocked nose', 'stuffy nose', 'nasal congestion', 'congestion', 'naak band', 'nose blocked']],
  ['sneezing', 'Sneezing', 'ent', ['sneezing', 'sneeze', 'sneezes', 'cheenk', 'chheenk']],
  ['breathlessness', 'Shortness of breath', 'respiratory', ['shortness of breath', 'short of breath', 'breathless', 'breathlessness', 'difficulty breathing', 'trouble breathing', "can't breathe", 'cannot breathe', 'saans phool', 'saans lene mein dikkat', 'saans ki takleef']],
  ['wheezing', 'Wheezing', 'respiratory', ['wheezing', 'wheeze', 'whistling sound when breathing', 'whistling breath']],
  ['chest_tightness', 'Chest tightness', 'respiratory', ['chest tightness', 'tight chest', 'chest feels tight']],
  ['ear_pain', 'Ear pain', 'ent', ['ear pain', 'earache', 'ear ache', 'kaan dard', 'kaan mein dard']],
  ['ear_discharge', 'Ear discharge', 'ent', ['ear discharge', 'pus from ear', 'fluid from ear', 'kaan beh']],
  ['hearing_loss', 'Reduced hearing', 'ent', ['reduced hearing', 'hearing loss', "can't hear properly", 'blocked ear', 'ear blocked']],

  // Heart
  ['chest_pain', 'Chest pain', 'cardio', ['chest pain', 'pain in chest', 'pain in my chest', 'chest pressure', 'heart pain', 'seene mein dard', 'chhati mein dard'], true],
  ['arm_jaw_pain', 'Pain spreading to arm or jaw', 'cardio', ['left arm pain', 'pain in left arm', 'arm pain', 'jaw pain', 'pain spreading to arm', 'pain radiating']],
  ['palpitations', 'Palpitations', 'cardio', ['palpitations', 'heart racing', 'racing heart', 'fast heartbeat', 'heart pounding', 'dhadkan tez', 'dil ki dhadkan']],

  // Stomach
  ['nausea', 'Nausea', 'gi', ['nausea', 'nauseous', 'nauseated', 'feel like vomiting', 'queasy', 'ji machla', 'jee machla']],
  ['vomiting', 'Vomiting', 'gi', ['vomiting', 'vomit', 'vomited', 'throwing up', 'threw up', 'ulti', 'ultee', 'ulti ho rahi']],
  ['diarrhea', 'Loose motions / diarrhoea', 'gi', ['diarrhea', 'diarrhoea', 'loose motion', 'loose motions', 'loosemotion', 'watery stool', 'dast']],
  ['constipation', 'Constipation', 'gi', ['constipation', 'constipated', 'hard stool', 'kabz', 'kabj']],
  ['stomach_pain', 'Stomach pain', 'gi', ['stomach pain', 'stomach ache', 'stomachache', 'abdominal pain', 'tummy ache', 'belly pain', 'cramps', 'pet dard', 'pet mein dard', 'pait dard']],
  ['lower_abdominal_pain', 'Lower abdominal pain', 'gi', ['lower abdominal pain', 'lower abdomen pain', 'lower belly pain', 'pelvic pain', 'lower stomach pain', 'neeche pet']],
  ['heartburn', 'Acidity / heartburn', 'gi', ['acidity', 'heartburn', 'acid reflux', 'burning in chest', 'burning chest', 'sour burps', 'seene mein jalan', 'khatti dakar']],
  ['bloating', 'Bloating / gas', 'gi', ['bloating', 'bloated', 'gas', 'gastric', 'flatulence', 'pet phool', 'afara', 'gas problem']],
  ['blood_stool_vomit', 'Blood in vomit or stool', 'gi', ['blood in stool', 'blood in vomit', 'vomiting blood', 'black stool', 'black stools', 'bloody stool', 'blood in potty'], true],

  // Urinary
  ['burning_urination', 'Burning urination', 'urinary', ['burning urination', 'burning while urinating', 'burning while peeing', 'painful urination', 'pain while urinating', 'burning pee', 'peshab mein jalan', 'pesab me jalan', 'urine mein jalan']],
  ['frequent_urination', 'Frequent urination', 'urinary', ['frequent urination', 'urinating often', 'peeing a lot', 'peeing often', 'baar baar peshab', 'bar bar pesab']],
  ['cloudy_urine', 'Cloudy / foul-smelling urine', 'urinary', ['cloudy urine', 'smelly urine', 'foul smelling urine', 'foul-smelling urine']],

  // Skin
  ['rash', 'Rash', 'skin', ['rash', 'rashes', 'skin rash', 'red spots', 'daane']],
  ['itching', 'Itching', 'skin', ['itching', 'itchy', 'itch', 'khujli', 'kharish']],
  ['skin_redness', 'Skin redness / hives', 'skin', ['hives', 'red patches', 'skin redness', 'red skin', 'skin swelling']],
  ['ring_rash', 'Ring-shaped scaly patch', 'skin', ['ringworm', 'ring shaped rash', 'ring-shaped rash', 'circular rash', 'scaly patch', 'daad', 'dad khaj']],
  ['pimples', 'Pimples / acne', 'skin', ['pimples', 'pimple', 'acne', 'zits', 'breakouts', 'muhase', 'muhanse']],

  // Eyes
  ['red_eyes', 'Red eyes', 'eyes', ['red eyes', 'red eye', 'pink eye', 'eye redness', 'laal aankh', 'aankh laal', 'aankhen laal']],
  ['eye_discharge', 'Eye discharge', 'eyes', ['eye discharge', 'sticky eyes', 'pus in eye', 'discharge from eye']],
  ['itchy_eyes', 'Itchy / watery eyes', 'eyes', ['itchy eyes', 'watery eyes', 'eyes watering', 'aankh se paani', 'aankhon mein khujli']],
  ['blurred_vision', 'Blurred vision', 'eyes', ['blurred vision', 'blurry vision', 'vision is blurry', 'dhundhla']],

  // Bones & muscles
  ['back_pain', 'Back pain', 'musculoskeletal', ['back pain', 'backache', 'back ache', 'lower back pain', 'kamar dard', 'kamar mein dard', 'peeth dard']],
  ['joint_pain', 'Joint pain', 'musculoskeletal', ['joint pain', 'joints pain', 'joint ache', 'knee pain', 'jodon mein dard', 'jodo ka dard', 'ghutne mein dard']],
  ['joint_swelling', 'Joint swelling', 'musculoskeletal', ['joint swelling', 'swollen joint', 'swollen joints', 'swollen knee', 'swollen ankle']],
  ['morning_stiffness', 'Morning stiffness', 'musculoskeletal', ['morning stiffness', 'stiff in the morning', 'stiff joints in the morning']],
  ['injury', 'Recent injury / twist', 'musculoskeletal', ['injury', 'injured', 'twisted my ankle', 'twisted', 'sprain', 'sprained', 'fell down', 'moch', 'chot lagi', 'chot']],

  // Mind
  ['anxiety', 'Anxiety / nervousness', 'mental', ['anxiety', 'anxious', 'nervous', 'panic', 'panic attack', 'worried all the time', 'overthinking', 'ghabrahat', 'bechaini']],
  ['sleep_problems', 'Sleep problems', 'mental', ['insomnia', "can't sleep", 'cannot sleep', 'trouble sleeping', 'sleep problems', 'poor sleep', 'neend nahi', 'neend nahin']],
  ['low_mood', 'Low mood', 'mental', ['low mood', 'feeling low', 'sad all the time', 'depressed', 'depression', 'hopeless', 'udaas', 'man nahi lagta']],
  ['self_harm_thoughts', 'Thoughts of self-harm', 'mental', ['suicide', 'suicidal', 'kill myself', 'end my life', 'self harm', 'self-harm', 'hurt myself', 'want to die', 'marna chahta', 'marna chahti', 'jeena nahi chahta', 'jeena nahi chahti'], true],

  // Women's health
  ['period_pain', 'Period pain / cramps', 'womens', ['period pain', 'periods pain', 'period cramps', 'menstrual cramps', 'menstrual pain', 'painful periods', 'mc pain', 'dysmenorrhea', 'dysmenorrhoea']],
].map(([code, name, system, aliases, redFlag = false]) => ({ code, name, system, aliases, redFlag }));

// Which department handles each body system when no condition fits well.
const SYSTEM_DEPARTMENT = {
  general: 'General Medicine', neuro: 'Neurology', respiratory: 'Pulmonology', ent: 'ENT',
  cardio: 'Cardiology', gi: 'Gastroenterology', urinary: 'General Medicine', skin: 'Dermatology',
  eyes: 'Ophthalmology', musculoskeletal: 'Orthopaedics', mental: 'Psychiatry', womens: 'Gynaecology',
};

// ---------- Medicine categories (general guidance, never doses) ----------
const MEDICINES = [
  { code: 'antipyretic', category: 'Fever & pain reliever (antipyretic / analgesic)', examples: 'Paracetamol', caution: 'Follow the dose on the label and keep 4–6 hours between doses. Never take two paracetamol-containing products together. Avoid if you have liver disease.', otc: 1 },
  { code: 'antipyretic_dengue', category: 'Fever reliever — paracetamol only', examples: 'Paracetamol', caution: 'Do not take ibuprofen, aspirin, diclofenac or other NSAID painkillers while dengue is possible — they increase bleeding risk.', otc: 1 },
  { code: 'nsaid', category: 'Anti-inflammatory pain reliever (NSAID)', examples: 'Ibuprofen, mefenamic acid', caution: 'Take after food. Avoid with stomach ulcers, kidney disease, painkiller-triggered asthma, pregnancy, or possible dengue.', otc: 1 },
  { code: 'cough_cold', category: 'Cough & cold relief', examples: 'Steam inhalation, saline nasal drops, throat lozenges, honey in warm water', caution: 'No honey for babies under 1 year. Cough syrups are not advised for children under 4. Check labels for drowsiness warnings.', otc: 1 },
  { code: 'ors', category: 'Oral rehydration salts (ORS)', examples: 'WHO-formula ORS sachets; zinc for children on a doctor\'s advice', caution: 'Mix exactly as the pack says in clean drinking water. Don\'t add extra sugar or salt.', otc: 1 },
  { code: 'antacid', category: 'Antacid / acid reducer', examples: 'Antacid gel or chewable tablets', caution: 'For short-term use. If you need it for more than 2 weeks, see a doctor.', otc: 1 },
  { code: 'antihistamine', category: 'Anti-allergy (antihistamine)', examples: 'Cetirizine, levocetirizine, loratadine', caution: 'Can cause drowsiness — don\'t drive if you feel sleepy. Ask a doctor first if pregnant or breastfeeding.', otc: 1 },
  { code: 'topical_antifungal', category: 'Antifungal cream', examples: 'Clotrimazole or terbinafine cream, antifungal dusting powder', caution: 'Keep using for 2 weeks after the rash clears. Avoid creams that also contain a steroid (e.g. clobetasol, betamethasone) — they make fungal infections worse.', otc: 1 },
  { code: 'acne_topical', category: 'Acne care (topical)', examples: 'Benzoyl peroxide 2.5% gel, salicylic acid face wash', caution: 'Start with a small amount once a day — it can dry the skin. Use sunscreen.', otc: 1 },
  { code: 'topical_analgesic', category: 'Pain-relief gel & compresses', examples: 'Diclofenac gel, hot or cold compress', caution: 'Don\'t apply on broken skin. Wash hands after applying.', otc: 1 },
  { code: 'eye_lubricant', category: 'Lubricating eye drops', examples: 'Carboxymethylcellulose (artificial tears)', caution: 'Never use steroid eye drops without an eye doctor\'s prescription.', otc: 1 },
  { code: 'prescription_only', category: 'Needs a doctor\'s prescription', examples: '', caution: 'This is usually treated with medicines such as antibiotics, inhalers or hormones, which need an examination and a prescription first. Don\'t use leftover medicines.', otc: 0 },
  { code: 'no_medicine', category: 'No medicine needed for now', examples: '', caution: 'The self-care steps above are the treatment. Talk to a doctor before starting any medicine.', otc: 0 },
  { code: 'emergency', category: 'Don\'t self-medicate — get medical help first', examples: '', caution: 'Medicines taken now can hide warning signs or cause harm. Get emergency care first.', otc: 0 },
];

// ---------- Conditions ----------
// weights: how strongly each symptom points to the condition
// need:    groups — at least one symptom from EVERY group must be present
// against: symptoms that make the condition less likely
// base:    starting urgency (self_care | doctor_soon | urgent)
const CONDITIONS = [
  {
    code: 'common_cold', name: 'Common cold (viral throat & nose infection)', department: 'General Medicine', medicine: 'cough_cold', base: 'self_care',
    weights: { runny_nose: 3, blocked_nose: 2, sneezing: 2, sore_throat: 2, cough: 2, fever: 1, headache: 1, fatigue: 1 },
    need: [['runny_nose', 'blocked_nose', 'sneezing', 'sore_throat']],
    against: ['high_fever'],
    advice: ['Rest and drink warm fluids — water, soups, herbal tea.', 'Steam inhalation or saline nasal drops ease a blocked nose.', 'Gargle with warm salt water for a sore throat.', 'Most colds get better on their own within 7–10 days.'],
  },
  {
    code: 'cough', name: 'Cough (throat irritation / viral)', department: 'General Medicine', medicine: 'cough_cold', base: 'self_care',
    weights: { cough: 4, sore_throat: 1, blocked_nose: 1, runny_nose: 1 },
    need: [['cough']],
    against: ['breathlessness', 'wheezing', 'chest_tightness', 'high_fever'],
    advice: ['Sip warm water, soups or herbal tea through the day.', 'Steam inhalation and honey in warm water soothe the throat.', 'Avoid smoke, dust and very cold drinks.', 'See a doctor if it lasts more than 2 weeks, you cough up blood, or you get breathless.'],
  },
  {
    code: 'viral_fever', name: 'Viral fever / flu', department: 'General Medicine', medicine: 'antipyretic', base: 'self_care',
    weights: { fever: 3, high_fever: 2, body_ache: 3, chills: 2, headache: 2, fatigue: 2, cough: 1, sore_throat: 1 },
    need: [['fever', 'high_fever']],
    advice: ['Rest and drink plenty of fluids; ORS helps if you are sweating a lot.', 'Sponge with lukewarm (not cold) water if the temperature is high.', 'Check your temperature morning and evening and note it down.', 'If fever lasts more than 3 days, see a doctor — dengue, malaria and typhoid need to be ruled out.'],
    tests: ['Complete Blood Count (CBC)'],
  },
  {
    code: 'dengue', name: 'Dengue (suspected)', department: 'General Medicine', medicine: 'antipyretic_dengue', base: 'urgent',
    weights: { high_fever: 3, fever: 2, eye_pain: 3, joint_pain: 2, body_ache: 2, headache: 2, rash: 2, nausea: 1, vomiting: 1, fatigue: 1 },
    need: [['fever', 'high_fever'], ['eye_pain', 'rash', 'joint_pain']],
    advice: ['Get a blood test today — the NS1 antigen test and platelet count confirm dengue.', 'Drink plenty of fluids: water, ORS, coconut water, soups.', 'Use only paracetamol for fever. Avoid ibuprofen, aspirin and other painkillers.', 'Go to emergency for severe stomach pain, repeated vomiting, bleeding gums or nose, black stools, or drowsiness.'],
    tests: ['Dengue NS1 Antigen', 'Complete Blood Count (CBC)'],
  },
  {
    code: 'malaria', name: 'Malaria (suspected)', department: 'General Medicine', medicine: 'prescription_only', base: 'urgent',
    weights: { fever: 3, high_fever: 2, chills: 3, sweating: 3, headache: 2, nausea: 1, vomiting: 1, body_ache: 1, fatigue: 1 },
    need: [['fever', 'high_fever'], ['chills', 'sweating']],
    advice: ['Fever with shivering that comes and goes is a classic sign of malaria — get tested today.', 'A rapid malaria antigen test gives results within hours.', 'Malaria needs prescribed medicines; don\'t start any antimalarial on your own. Paracetamol can ease the fever meanwhile.', 'Use mosquito nets and repellent so others at home stay protected.'],
    tests: ['Malaria Antigen (Rapid)', 'Complete Blood Count (CBC)'],
  },
  {
    code: 'typhoid', name: 'Typhoid (suspected)', department: 'General Medicine', medicine: 'prescription_only', base: 'doctor_soon', minDays: 4,
    weights: { fever: 3, high_fever: 1, stomach_pain: 2, fatigue: 2, loss_appetite: 2, headache: 1, constipation: 1, diarrhea: 1, nausea: 1 },
    need: [['fever', 'high_fever'], ['stomach_pain', 'loss_appetite', 'constipation', 'diarrhea']],
    advice: ['A fever that keeps going for several days with stomach upset can be typhoid — a doctor should examine you.', 'Eat soft, freshly cooked food and drink only boiled or filtered water.', 'Typhoid needs a full course of prescribed antibiotics; never use leftover antibiotics.', 'Wash hands with soap before eating and after using the toilet.'],
    tests: ['Typhoid IgM (Rapid)', 'Complete Blood Count (CBC)'],
  },
  {
    code: 'gastroenteritis', name: 'Stomach infection (gastroenteritis)', department: 'General Medicine', medicine: 'ors', base: 'self_care',
    weights: { diarrhea: 3, vomiting: 3, nausea: 2, stomach_pain: 2, fever: 1, loss_appetite: 1, dehydration: 1 },
    need: [['diarrhea', 'vomiting']],
    advice: ['Sip ORS after every loose motion or vomit — small, frequent sips.', 'Eat light food: khichdi, curd rice, bananas, toast.', 'Skip outside food and oily or milk-heavy meals until you recover.', 'See a doctor if you can\'t keep fluids down, pass very little urine, or it lasts beyond 2 days.'],
  },
  {
    code: 'acidity', name: 'Acidity / acid reflux', department: 'Gastroenterology', medicine: 'antacid', base: 'self_care',
    weights: { heartburn: 4, bloating: 2, stomach_pain: 1, nausea: 1 },
    need: [['heartburn', 'bloating']],
    advice: ['Eat smaller meals and don\'t lie down for 2–3 hours after eating.', 'Cut down on spicy, oily and fried food, tea and coffee, and late-night meals.', 'Raise the head end of your bed if it is worse at night.', 'See a doctor if you need antacids for more than 2 weeks, find swallowing hard, or lose weight.'],
  },
  {
    code: 'migraine', name: 'Migraine', department: 'Neurology', medicine: 'antipyretic', base: 'self_care',
    weights: { one_sided_headache: 4, headache: 2, light_sensitivity: 3, nausea: 2, vomiting: 1, dizziness: 1 },
    need: [['one_sided_headache', 'headache'], ['one_sided_headache', 'light_sensitivity', 'nausea']],
    advice: ['Rest in a dark, quiet room with a cold pack on your forehead.', 'Take a pain reliever early in the attack — it works better than waiting.', 'Keep a headache diary: sleep, missed meals, screen time and stress are common triggers.', 'See a neurologist if you get more than 4 headaches a month or the pattern changes.'],
  },
  {
    code: 'tension_headache', name: 'Tension headache', department: 'General Medicine', medicine: 'antipyretic', base: 'self_care',
    weights: { headache: 3, anxiety: 1, sleep_problems: 1, fatigue: 1 },
    need: [['headache']],
    against: ['fever', 'high_fever', 'one_sided_headache'],
    advice: ['Take a break from screens every 30–40 minutes and check your posture.', 'Drink enough water and don\'t skip meals.', 'Gentle neck stretches and a warm compress relax tight muscles.', 'Aim for 7–8 hours of regular sleep.'],
  },
  {
    code: 'allergic_rhinitis', name: 'Nasal allergy (allergic rhinitis)', department: 'ENT', medicine: 'antihistamine', base: 'self_care',
    weights: { sneezing: 3, itchy_eyes: 3, runny_nose: 2, blocked_nose: 2 },
    need: [['sneezing', 'itchy_eyes']],
    against: ['fever', 'high_fever', 'sore_throat'],
    advice: ['Notice your triggers — dust, pollen, pets, smoke — and reduce exposure.', 'Wash pillow covers weekly and keep windows closed on high-pollution days.', 'Saline nasal rinses wash out allergens.', 'See an ENT doctor if it lasts for weeks or disturbs your sleep.'],
  },
  {
    code: 'skin_allergy', name: 'Skin allergy / hives', department: 'Dermatology', medicine: 'antihistamine', base: 'self_care',
    weights: { itching: 3, skin_redness: 3, rash: 2 },
    need: [['itching', 'skin_redness', 'rash']],
    against: ['fever', 'high_fever', 'ring_rash'],
    advice: ['Think about anything new — soap, detergent, cosmetics, food or medicine — and stop it.', 'Apply a cool compress or calamine lotion; try not to scratch.', 'Wear loose cotton clothing.', 'Get emergency help if your lips or face swell or breathing gets difficult.'],
  },
  {
    code: 'fungal_infection', name: 'Fungal skin infection (ringworm)', department: 'Dermatology', medicine: 'topical_antifungal', base: 'self_care',
    weights: { ring_rash: 4, itching: 3, rash: 1 },
    need: [['ring_rash']],
    advice: ['Keep the area clean and completely dry, especially skin folds.', 'Wear loose cotton clothes and change out of sweaty clothes quickly.', 'Don\'t share towels; wash clothes in hot water.', 'See a dermatologist if it spreads or doesn\'t improve in 2 weeks.'],
  },
  {
    code: 'acne', name: 'Acne', department: 'Dermatology', medicine: 'acne_topical', base: 'self_care',
    weights: { pimples: 4 },
    need: [['pimples']],
    advice: ['Wash your face twice a day with a gentle cleanser.', 'Don\'t squeeze or pick pimples — it leaves marks and scars.', 'Choose oil-free, non-comedogenic skin products.', 'See a dermatologist for painful lumps or scarring.'],
  },
  {
    code: 'uti', name: 'Urinary tract infection (UTI)', department: 'General Medicine', medicine: 'prescription_only', base: 'doctor_soon',
    weights: { burning_urination: 4, frequent_urination: 3, cloudy_urine: 2, lower_abdominal_pain: 2, fever: 1 },
    need: [['burning_urination', 'cloudy_urine']],
    advice: ['Drink plenty of water unless a doctor has told you to limit fluids.', 'Don\'t hold urine for long.', 'UTIs usually need a short antibiotic course after a urine test — see a doctor.', 'Fever, back or side pain, or vomiting can mean the kidneys are involved: see a doctor today.'],
    tests: ['Urine Routine & Microscopy'],
  },
  {
    code: 'back_pain', name: 'Muscular back pain', department: 'Orthopaedics', medicine: 'topical_analgesic', base: 'self_care',
    weights: { back_pain: 4, morning_stiffness: 1, injury: 1 },
    need: [['back_pain']],
    advice: ['Keep moving gently — staying in bed for days slows recovery.', 'Use a warm compress and check your chair height and sitting posture.', 'Lift with your knees, not your back.', 'See a doctor urgently for leg numbness, loss of bladder or bowel control, or pain after a fall.'],
  },
  {
    code: 'arthritis', name: 'Joint inflammation (arthritis)', department: 'Orthopaedics', medicine: 'nsaid', base: 'doctor_soon',
    weights: { joint_pain: 3, joint_swelling: 3, morning_stiffness: 3 },
    need: [['joint_pain', 'joint_swelling']],
    against: ['injury', 'fever', 'high_fever'],
    advice: ['Gentle exercise and stretching keep joints moving.', 'Warm compresses ease stiffness; cold packs reduce swelling.', 'A healthy weight takes load off knees and hips.', 'An orthopaedic doctor can check for arthritis or gout with an exam and blood tests.'],
    tests: ['Kidney Function Test (KFT)'],
  },
  {
    code: 'sprain', name: 'Sprain / soft-tissue injury', department: 'Orthopaedics', medicine: 'topical_analgesic', base: 'self_care',
    weights: { injury: 4, joint_pain: 2, joint_swelling: 2 },
    need: [['injury']],
    advice: ['Follow RICE: Rest, Ice for 15 minutes every 2–3 hours, Compression bandage, Elevation.', 'Keep weight off it for the first 48 hours.', 'See a doctor if you can\'t put weight on it, it looks misshapen, or swelling keeps increasing — it may be a fracture.'],
  },
  {
    code: 'asthma', name: 'Asthma / bronchitis', department: 'Pulmonology', medicine: 'prescription_only', base: 'doctor_soon',
    weights: { wheezing: 4, breathlessness: 3, chest_tightness: 3, cough: 2 },
    need: [['wheezing', 'chest_tightness', 'breathlessness']],
    advice: ['Sit upright, stay calm and loosen tight clothing.', 'If you already have a prescribed inhaler, use it as your doctor told you.', 'Stay away from smoke, dust and cold air.', 'A chest specialist can test your breathing (spirometry) and prescribe the right inhaler.'],
  },
  {
    code: 'anaemia', name: 'Anaemia — low haemoglobin (suspected)', department: 'General Medicine', medicine: 'prescription_only', base: 'doctor_soon',
    weights: { fatigue: 3, pale_skin: 3, dizziness: 2, breathlessness: 1, hair_loss: 1 },
    need: [['fatigue', 'pale_skin'], ['pale_skin', 'dizziness', 'breathlessness']],
    advice: ['A simple blood test (CBC) checks your haemoglobin.', 'Eat iron-rich foods — green leafy vegetables, jaggery, dates, lentils, eggs, meat — with vitamin C (lemon, amla) to absorb iron better.', 'Avoid tea or coffee with meals; it blocks iron absorption.', 'Take iron tablets only after a test and a doctor\'s advice.'],
    tests: ['Complete Blood Count (CBC)', 'Vitamin B12'],
  },
  {
    code: 'diabetes', name: 'High blood sugar / diabetes (suspected)', department: 'Endocrinology', medicine: 'prescription_only', base: 'doctor_soon',
    weights: { excess_thirst: 4, frequent_urination: 3, weight_loss: 2, blurred_vision: 2, fatigue: 1 },
    need: [['excess_thirst', 'weight_loss', 'blurred_vision'], ['excess_thirst', 'frequent_urination']],
    advice: ['Get your blood sugar checked — fasting glucose and HbA1c.', 'Cut down on sugary drinks, sweets and refined carbs like maida.', 'Walk at least 30 minutes a day.', 'Diabetes runs in families; yearly screening is worthwhile after age 30.'],
    tests: ['Fasting Blood Sugar (FBS)', 'HbA1c'],
  },
  {
    code: 'hypothyroid', name: 'Underactive thyroid (suspected)', department: 'Endocrinology', medicine: 'prescription_only', base: 'doctor_soon',
    weights: { weight_gain: 3, cold_intolerance: 3, fatigue: 2, hair_loss: 2, constipation: 1, low_mood: 1 },
    need: [['weight_gain', 'cold_intolerance', 'hair_loss'], ['fatigue', 'weight_gain', 'cold_intolerance', 'constipation']],
    advice: ['A thyroid profile (TSH, T3, T4) confirms this.', 'Thyroid problems are common — especially in women — and very treatable.', 'Use iodised salt.', 'Don\'t start thyroid tablets without a test and a prescription.'],
    tests: ['Thyroid Profile (T3, T4, TSH)'],
  },
  {
    code: 'conjunctivitis', name: 'Eye infection (conjunctivitis)', department: 'Ophthalmology', medicine: 'eye_lubricant', base: 'self_care',
    weights: { red_eyes: 4, eye_discharge: 3, itchy_eyes: 2 },
    need: [['red_eyes']],
    advice: ['Clean discharge with cooled boiled water and a fresh cotton pad for each eye.', 'Wash hands often and don\'t share towels, pillows or eye make-up.', 'Don\'t rub your eyes; skip contact lenses until it clears.', 'See an eye doctor for eye pain, blurred vision or sensitivity to light.'],
  },
  {
    code: 'ear_infection', name: 'Ear infection', department: 'ENT', medicine: 'antipyretic', base: 'doctor_soon',
    weights: { ear_pain: 4, ear_discharge: 3, hearing_loss: 2, fever: 1 },
    need: [['ear_pain', 'ear_discharge']],
    advice: ['Keep the ear dry — no oil, water or cotton buds inside.', 'A warm cloth held against the ear can ease the pain.', 'An ENT doctor should check any discharge or reduced hearing.'],
  },
  {
    code: 'anxiety', name: 'Anxiety / stress', department: 'Psychiatry', medicine: 'no_medicine', base: 'self_care',
    weights: { anxiety: 4, palpitations: 2, sleep_problems: 2, low_mood: 1, fatigue: 1 },
    need: [['anxiety']],
    advice: ['Try slow breathing: in for 4 counts, hold for 4, out for 6 — for 5 minutes.', 'Regular sleep, daily physical activity and less caffeine help a lot.', 'Talk to someone you trust about what is on your mind.', 'If worry affects daily life for more than two weeks, a psychiatrist or counsellor can help. Tele-MANAS (14416) is free and available 24×7.'],
  },
  {
    code: 'low_mood', name: 'Low mood (possible depression)', department: 'Psychiatry', medicine: 'no_medicine', base: 'doctor_soon',
    weights: { low_mood: 4, sleep_problems: 2, fatigue: 2, loss_appetite: 1, anxiety: 1 },
    need: [['low_mood']],
    advice: ['You don\'t have to handle this alone — tell someone you trust how you feel.', 'Keep a simple routine: regular meals, sleep, and a short walk outdoors each day.', 'Low mood lasting more than two weeks deserves a check-up with a psychiatrist or counsellor.', 'Free, confidential support any time: Tele-MANAS 14416.'],
  },
  {
    code: 'period_pain', name: 'Menstrual cramps', department: 'Gynaecology', medicine: 'nsaid', base: 'self_care',
    weights: { period_pain: 4, lower_abdominal_pain: 2, back_pain: 1, nausea: 1 },
    need: [['period_pain']],
    advice: ['A hot water bag on the lower abdomen relaxes the muscles.', 'Light activity, stretching and warm fluids help.', 'See a gynaecologist if pain stops your daily activities, periods are very heavy, or the pain is new and severe.'],
  },
  {
    code: 'heat_exhaustion', name: 'Dehydration / heat exhaustion', department: 'General Medicine', medicine: 'ors', base: 'self_care',
    weights: { dehydration: 3, dizziness: 2, fatigue: 2, headache: 1, sweating: 1, nausea: 1 },
    need: [['dehydration'], ['dizziness', 'fatigue', 'headache', 'nausea']],
    advice: ['Move to a cool place and sip ORS or lemon water with a pinch of salt and sugar.', 'Avoid going out between 12 and 4 pm in hot weather.', 'Get emergency help for confusion, fainting or a very high body temperature — that can be heat stroke.'],
  },
];

// ---------- Red-flag rules (checked before anything else) ----------
// Each rule: when(has) -> true means the rule fires.
const RED_FLAGS = [
  {
    code: 'cardiac', level: 'emergency', department: 'Cardiology',
    when: (has) => has('chest_pain') && (has('breathlessness') || has('sweating') || has('arm_jaw_pain') || has('dizziness') || has('fainting') || has('nausea')),
    message: 'Chest pain with breathlessness, sweating, nausea or pain spreading to the arm or jaw can be a heart attack.',
  },
  {
    code: 'stroke', level: 'emergency', department: 'Neurology',
    when: (has) => has('stroke_signs'),
    message: 'Sudden weakness on one side, a drooping face or slurred speech can be a stroke. Note the time the symptoms started.',
  },
  {
    code: 'neuro', level: 'emergency', department: 'Neurology',
    when: (has) => has('confusion') || has('seizure') || has('fainting'),
    message: 'Confusion, a seizure or fainting needs to be checked by a doctor immediately.',
  },
  {
    code: 'meningitis', level: 'emergency', department: 'Neurology',
    when: (has) => (has('fever') || has('high_fever')) && has('neck_stiffness') && (has('headache') || has('light_sensitivity') || has('rash') || has('vomiting')),
    message: 'Fever with a stiff neck and headache can be meningitis, which needs same-hour treatment.',
  },
  {
    code: 'bleeding', level: 'emergency', department: 'Gastroenterology',
    when: (has) => has('blood_stool_vomit'),
    message: 'Blood in vomit or black/bloody stools can mean internal bleeding.',
  },
  {
    code: 'breathing', level: 'emergency', department: 'Pulmonology',
    when: (has, ctx) => has('breathlessness') && ctx.severity === 'severe',
    message: 'Severe difficulty breathing needs emergency care.',
  },
  {
    code: 'chest_pain', level: 'urgent', department: 'Cardiology',
    when: (has) => has('chest_pain'),
    message: 'Chest pain should be checked by a doctor today, even if it feels mild.',
  },
  {
    code: 'dehydration', level: 'urgent', department: 'General Medicine',
    when: (has) => has('dehydration') && (has('diarrhea') || has('vomiting')),
    message: 'Loose motions or vomiting with signs of dehydration (dry mouth, very little urine) need a doctor today.',
  },
  {
    code: 'fever_vulnerable', level: 'urgent', department: 'General Medicine',
    when: (has, ctx) => (has('high_fever') || has('fever')) && ctx.age !== null && (ctx.age < 5 || ctx.age >= 65) && (has('high_fever') || ctx.severity === 'severe'),
    message: 'High fever in young children and older adults should be seen by a doctor today.',
  },
];

const URGENCY = {
  self_care: { rank: 0, label: 'Self-care at home', message: 'This can usually be managed at home. Book a doctor if you don\'t feel better or anything new appears.' },
  doctor_soon: { rank: 1, label: 'See a doctor in 1–2 days', message: 'Book an appointment in the next day or two so a doctor can examine you.' },
  urgent: { rank: 2, label: 'See a doctor today', message: 'Please see a doctor today. Book the earliest slot, or visit a clinic.' },
  emergency: { rank: 3, label: 'Emergency — get help now', message: 'Call 112 (or 108 for an ambulance) or go to the nearest emergency department now. Don\'t drive yourself.' },
};

module.exports = { SYMPTOMS, SYSTEM_DEPARTMENT, MEDICINES, CONDITIONS, RED_FLAGS, URGENCY };
