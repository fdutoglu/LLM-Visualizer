"""Token labels. Formal labels are computed from the string (background: all tokens),
semantic labels come from hand-written lists (background: tokens in Latin letters)."""
import re, unicodedata
SC = {"Cyrillic": "CYRILLIC", "Arabic": "ARABIC", "Hangul": "HANGUL", "Hiragana": "HIRAGANA", "Katakana": "KATAKANA", "Greek": "GREEK", "Devanagari": "DEVANAGARI", "Thai": "THAI", "Hebrew": "HEBREW", "Bengali": "BENGALI", "Georgian": "GEORGIAN", "Han": "CJK"}
SEM = {k: v.split() for k, v in {
"country": "france germany italy spain portugal england ireland poland russia ukraine turkey greece egypt china japan india brazil mexico canada australia iran iraq israel sweden norway finland denmark austria hungary romania bulgaria cuba chile peru argentina colombia venezuela vietnam thailand indonesia malaysia philippines pakistan kenya nigeria ghana ethiopia morocco algeria syria korea netherlands belgium switzerland",
"city": "paris london berlin rome madrid lisbon dublin warsaw moscow kyiv istanbul ankara athens cairo beijing tokyo delhi mumbai toronto sydney tehran baghdad jerusalem stockholm oslo helsinki vienna budapest bucharest sofia havana santiago lima bogota hanoi bangkok jakarta manila karachi nairobi lagos boston chicago seattle houston dallas atlanta miami denver shanghai osaka barcelona milan munich",
"language/nationality": "french german italian spanish portuguese english irish polish russian ukrainian turkish greek egyptian chinese japanese indian brazilian mexican canadian australian iranian iraqi israeli swedish norwegian finnish danish austrian hungarian romanian bulgarian cuban chilean korean vietnamese thai indonesian dutch belgian swiss arabic hebrew hindi latin",
"month/day": "january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday",
"number word": "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion",
"color": "red green blue yellow orange purple pink brown black white gray grey violet turquoise crimson beige maroon indigo magenta cyan teal gold silver",
"animal": "dog cat horse cow pig sheep goat lion tiger bear wolf fox rabbit mouse rat elephant monkey deer snake lizard frog fish shark whale dolphin bird eagle owl duck chicken turkey bee ant spider butterfly crocodile turtle camel donkey giraffe zebra leopard squirrel penguin parrot",
"body": "head face eye eyes ear nose mouth tooth teeth tongue neck shoulder arm elbow hand finger thumb chest back stomach hip leg knee foot feet toe skin bone brain heart lung liver kidney muscle blood hair",
"family": "mother father brother sister son daughter uncle aunt cousin nephew niece grandfather grandmother husband wife parent parents child children mom dad grandson granddaughter siblings",
"male name": "john david michael james robert william richard thomas charles george paul mark peter daniel matthew andrew steven kevin brian edward jason jeff ryan eric frank jacob scott henry adam nathan patrick jack",
"female name": "mary linda patricia jennifer elizabeth barbara susan jessica sarah karen lisa nancy margaret sandra emily emma olivia sophia anna julia laura michelle kimberly amanda melissa rebecca rachel catherine helen maria alice jane",
"food": "bread cheese butter milk meat beef pork rice pasta pizza soup salad sugar salt pepper garlic onion tomato potato carrot apple banana grape lemon mango cherry chocolate coffee tea wine beer juice cake cookie egg eggs honey bacon sausage",
"occupation": "doctor nurse teacher lawyer engineer farmer chef pilot soldier police actor actress singer writer artist painter scientist professor judge dentist plumber carpenter mechanic driver waiter banker accountant architect journalist programmer musician baker",
"sport": "football soccer basketball baseball tennis golf hockey rugby cricket volleyball boxing wrestling swimming skiing cycling athletics gymnastics marathon",
"clothing": "shirt pants shoes shoe hat coat jacket dress skirt socks gloves scarf jeans sweater boots boot belt suit tie hoodie",
"emotion": "happy sad angry afraid scared anxious excited proud ashamed jealous lonely joyful depressed nervous frustrated grateful disgusted surprised worried calm",
"pronoun": "i you he she it we they me him her us them my your his its our their mine yours hers ours theirs myself yourself himself herself",
"preposition": "in on at by for with about against between into through during before after above below from under over of off near within without across behind beyond toward towards among",
"question word": "what who whom whose which when where why how",
"element": "hydrogen helium lithium carbon nitrogen oxygen sodium magnesium aluminum silicon phosphorus sulfur chlorine potassium calcium iron copper zinc silver gold mercury lead uranium nickel titanium",
"code keyword": "def return import class void int bool float double const static public private struct lambda async await println printf elif endif typedef boolean str enum",
"disease": "cancer diabetes flu asthma malaria tuberculosis pneumonia stroke fever infection hiv aids alzheimer arthritis depression influenza covid leukemia hepatitis",
"vehicle": "car truck bus train plane airplane bicycle bike motorcycle boat ship helicopter van taxi subway tram ferry tractor scooter",
"field of study": "physics chemistry biology mathematics math history geography philosophy psychology sociology economics linguistics astronomy geology anthropology engineering",
}.items()}
def base(t): return (t or "").lstrip("▁").lower()
def build(ids):
    """-> (ids used, {name: (background bool list, label bool list)})"""
    keep = [i for i, t in enumerate(ids) if t and not re.fullmatch(r"<.*>|\[multimodal\]", t) or (t and re.fullmatch(r"<(0x..|/?[a-z0-9]{1,10})>", t))]
    keep = [i for i in keep if i > 6 and not re.match(r"<unused", ids[i])]
    T = [ids[i] for i in keep]; U = [t.replace("▁", "") for t in T]; al = [u.isalpha() for u in U]
    lat = [bool(re.fullmatch(r"▁?[A-Za-zÀ-ɏḀ-ỿ]+", t)) for t in T]; asc = [bool(re.fullmatch(r"▁?[A-Za-z]+", t)) for t in T]; n = len(T); all_ = [True] * n
    nm = [unicodedata.name(u[0], "") if u else "" for u in U]
    L = {"leading space": (al, [t.startswith("▁") for t in T]), "Latin": (all_, lat), "Latin, accented": (lat, [a and not b for a, b in zip(lat, asc)]),
         "Capitalized": (lat, [u[:1].isupper() and not (len(u) > 1 and u.isupper()) for u in U]), "ALL CAPS": (lat, [len(u) > 1 and u.isupper() for u in U]),
         "single character": (all_, [len(u) == 1 for u in U]), "long (≥10)": (lat, [len(u) >= 10 for u in U]), "no letters (punctuation)": (all_, [bool(u) and not any(c.isalnum() for c in u) for u in U]),
         "whitespace/newline": (all_, [not u.strip() for u in U]), "digit": (all_, [any(c.isdigit() for c in u) for u in U]), "byte": (all_, [bool(re.fullmatch("<0x..>", t)) for t in T]), "HTML": (all_, [bool(re.fullmatch("</?[a-z][a-z0-9]*>", t)) for t in T]),
         "camelCase": (lat, [bool(re.search("[a-z][A-Z]", u)) for u in U]), "Vietnamese letter": (lat, [bool(re.search("[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđơư]", u)) for u in U]), "Turkish letter": (lat, [bool(re.search("[ığşİĞŞ]", u)) for u in U]), "Polish/Czech letter": (lat, [bool(re.search("[łąęćńśźżěřůčž]", u)) for u in U])}
    for k, p in SC.items(): L[k] = (all_, [x.startswith(p) for x in nm])
    wl = [bool(re.fullmatch("▁[a-z]{4,}", t)) for t in T]
    for s in ("s", "ed", "ing", "ly", "tion", "ness", "ism", "able", "er"): L["-" + s] = (wl, [a and u.endswith(s) and not (s == "s" and u.endswith("ss")) for a, u in zip(wl, U)])
    B = [base(t) for t in T]
    for k, w in SEM.items(): S = set(w); L[k] = (asc, [a and b in S for a, b in zip(asc, B)])
    return keep, B, L
