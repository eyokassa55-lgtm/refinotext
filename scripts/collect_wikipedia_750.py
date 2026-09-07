#!/usr/bin/env python3
"""Collect 3000 unique English Wikipedia articles via the public MediaWiki API.

Uses only https://en.wikipedia.org/w/api.php (no API key, no HTML scraping).
Writes data/wikipedia_750.jsonl and data/wikipedia_750.xlsx (3000 rows).
Resumes from an existing JSONL file when present.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font

API_URL = "https://en.wikipedia.org/w/api.php"
ARTICLE_URL_PREFIX = "https://en.wikipedia.org/wiki/"
USER_AGENT = (
    "RefinoText-DatasetCollector/1.0 "
    "(https://refinotext.com; wikipedia-dataset for RefinoText humanizer; "
    "contact via https://refinotext.com/contact) "
    "Python-requests"
)

TARGET_COUNT = 3000
MIN_EXTRACT_CHARS = 500
STORE_MAX_CHARS = 4000
EXCEL_MAX_CELL = 32767
REQUEST_DELAY_SECONDS = 0.2
CHECKPOINT_EVERY = 50
MAX_RETRIES = 6
TIMEOUT_SECONDS = 45

SKIP_TITLE_RE = re.compile(
    r"""(?ix)
    ^(list|lists|index|outline|timeline|glossary|table|catalog|catalogue)\s+of\b
    | \bdisambiguation\b
    | ^deaths\s+in\b
    | ^births\s+in\b
    | \bseason\b
    | \d{4}[-–/]\d{2,4}
    | ^(history|geography|politics|economy|demographics|culture|religion|climate|
        transport|transportation|education|wildlife|communications|foreign\s+relations|
        military|administrative\s+divisions|census|flag|coat\s+of\s+arms|emblem)\s+of\b
    | \bin\s+popular\s+culture$
    """
)

SKIP_SUBCAT_RE = re.compile(
    r"""(?ix)
    stub|lists?|births|deaths|year|template|redirect|disambiguation|wiki|
    article|image|user|cs1|maintenance|hidden|navbox|alumni|fellows?|
    award|by\s+country|by\s+nationality|works?\s+by|people\s+from|
    establishments|introductions
    """
)

STOPWORDS = {
    "the", "of", "and", "in", "a", "an", "to", "for", "on", "by", "at", "from",
    "with", "or", "as",
}

TOPIC_ORDER = [
    "biology",
    "chemistry",
    "physics",
    "geography",
    "history",
    "economics",
    "civics",
    "technology",
    "environment",
    "sports",
    "education",
    "culture",
    "general",
]

TOPIC_CATEGORIES: dict[str, list[str]] = {
    "biology": [
        "Category:Biological processes",
        "Category:Cell biology",
        "Category:Genetics",
        "Category:Physiology",
        "Category:Botany",
        "Category:Zoology",
        "Category:Microbiology",
        "Category:Molecular biology",
        "Category:Anatomy",
        "Category:Neuroscience",
        "Category:Ecology",
        "Category:Evolutionary biology",
    ],
    "chemistry": [
        "Category:Chemical elements",
        "Category:Chemical processes",
        "Category:Chemical compounds",
        "Category:Organic chemistry",
        "Category:Inorganic chemistry",
        "Category:Physical chemistry",
        "Category:Analytical chemistry",
        "Category:Biochemistry",
        "Category:Materials science",
    ],
    "physics": [
        "Category:Physics",
        "Category:Classical mechanics",
        "Category:Quantum mechanics",
        "Category:Electromagnetism",
        "Category:Thermodynamics",
        "Category:Optics",
        "Category:Relativity",
        "Category:Particle physics",
        "Category:Astronomy",
        "Category:Physical quantities",
    ],
    "geography": [
        "Category:Landforms",
        "Category:Physical geography",
        "Category:Bodies of water",
        "Category:Mountain ranges",
        "Category:Deserts",
        "Category:Islands",
        "Category:Continents",
        "Category:Countries",
        "Category:Cities",
        "Category:Human geography",
    ],
    "history": [
        "Category:Historical events",
        "Category:Empires",
        "Category:Ancient history",
        "Category:Medieval history",
        "Category:Modern history",
        "Category:Revolutions",
        "Category:Wars",
        "Category:Archaeology",
        "Category:Civilizations",
        "Category:Battles",
        "Category:Former countries",
        "Category:Historical eras",
    ],
    "economics": [
        "Category:Economics",
        "Category:Macroeconomics",
        "Category:Microeconomics",
        "Category:Economic systems",
        "Category:Trade",
        "Category:Finance",
        "Category:Labour economics",
        "Category:International economics",
        "Category:Money",
    ],
    "civics": [
        "Category:Government",
        "Category:Political science",
        "Category:Public law",
        "Category:Constitutions",
        "Category:Democracy",
        "Category:Human rights",
        "Category:Public policy",
        "Category:Elections",
        "Category:Branches of government",
        "Category:Law",
    ],
    "technology": [
        "Category:Technology",
        "Category:Computing",
        "Category:Inventions",
        "Category:Engineering",
        "Category:Electronics",
        "Category:Telecommunications",
        "Category:Internet",
        "Category:Robotics",
        "Category:Software",
        "Category:Transportation technology",
    ],
    "environment": [
        "Category:Climate change",
        "Category:Conservation",
        "Category:Pollution",
        "Category:Renewable energy",
        "Category:Natural resources",
        "Category:Environmental issues",
        "Category:Biodiversity",
        "Category:Waste",
        "Category:Sustainability",
    ],
    "sports": [
        "Category:Sports",
        "Category:Olympic sports",
        "Category:Ball games",
        "Category:Athletics (sport)",
        "Category:Water sports",
        "Category:Combat sports",
        "Category:Sports equipment",
        "Category:Multi-sport events",
        "Category:Sport terminology",
        "Category:Team sports",
        "Category:Individual sports",
        "Category:Summer Olympic sports",
    ],
    "education": [
        "Category:Education",
        "Category:Pedagogy",
        "Category:Educational psychology",
        "Category:Curricula",
        "Category:Higher education",
        "Category:Literacy",
        "Category:Educational assessment",
        "Category:Learning",
        "Category:Schools",
    ],
    "culture": [
        "Category:The arts",
        "Category:Literature",
        "Category:Music",
        "Category:Visual arts",
        "Category:Film",
        "Category:Theatre",
        "Category:Dance",
        "Category:Mythology",
        "Category:Traditions",
        "Category:Cuisine",
    ],
    "general": [
        "Category:Academic disciplines",
        "Category:Philosophy",
        "Category:Mathematics",
        "Category:Health",
        "Category:Food and drink",
        "Category:Language",
        "Category:Architecture",
        "Category:Transport",
        "Category:Religion",
        "Category:Psychology",
        "Category:Medicine",
    ],
}

SEARCH_SEEDS: dict[str, list[str]] = {
    "biology": [
        "photosynthesis", "DNA", "cell biology", "evolution", "natural selection",
        "mitosis", "meiosis", "protein", "enzyme", "bacteria", "virus", "fungi",
        "chloroplast", "mitochondrion", "ribosome", "cell membrane", "osmosis",
        "immune system", "antibody", "neuron", "brain", "heart", "genome",
        "CRISPR", "RNA", "chromosome", "ecology", "biodiversity", "speciation",
        "extinction", "mammal", "photosynthetic bacteria", "hormone", "insulin",
        "digestive system", "blood", "skeleton", "botany", "zoology", "primate",
        "coral reef", "plankton", "symbiosis", "homeostasis", "punnett square",
        "transcription biology", "vaccine", "stem cell", "photosystem", "algae",
        "amphibian", "reptile", "insect", "bird migration", "human anatomy",
        "kidney", "liver", "lung", "muscle", "flower", "seed", "pollination",
        "food web", "trophic level", "genetic drift", "mutation", "phenotype",
    ],
    "chemistry": [
        "periodic table", "chemical bond", "covalent bond", "ionic bond",
        "hydrogen bond", "acid", "base chemistry", "pH", "oxidation",
        "reduction chemistry", "catalyst", "chemical equilibrium", "stoichiometry",
        "mole unit", "Avogadro constant", "organic chemistry", "hydrocarbon",
        "polymer", "benzene", "alcohol chemistry", "carboxyl", "amino acid",
        "carbon", "oxygen", "hydrogen", "nitrogen", "helium", "sodium",
        "chlorine", "iron", "gold", "silver", "copper", "silicon", "uranium",
        "radioactivity", "isotope", "electron", "proton", "neutron",
        "atomic nucleus", "chemical reaction", "combustion", "electrolysis",
        "distillation", "crystallization", "solution chemistry", "solubility",
        "thermochemistry", "enthalpy", "entropy chemistry", "Gibbs free energy",
        "spectroscopy", "chromatography", "titration", "buffer solution",
        "alkane", "alkene", "ester", "ketone", "photosynthesis chemistry",
        "water molecule", "ammonia", "sulfuric acid", "sodium chloride",
    ],
    "physics": [
        "classical mechanics", "Newton laws of motion", "gravity", "mass",
        "force", "energy", "momentum", "work physics", "power physics",
        "friction", "simple harmonic motion", "wave", "sound", "light",
        "optics", "refraction", "diffraction", "interference", "electromagnetism",
        "electric field", "magnetic field", "electric current", "voltage",
        "resistance electricity", "Ohm's law", "Maxwell equations",
        "thermodynamics", "heat", "temperature", "entropy", "ideal gas",
        "quantum mechanics", "photon", "electron physics", "uncertainty principle",
        "Schrodinger equation", "special relativity", "general relativity",
        "speed of light", "black hole", "neutron star", "big bang",
        "particle physics", "standard model", "quark", "boson", "Higgs boson",
        "nuclear fission", "nuclear fusion", "radioactive decay", "plasma physics",
        "superconductivity", "semiconductor physics", "laser", "telescope",
        "solar system", "planet", "star", "galaxy", "dark matter", "cosmology",
    ],
    "geography": [
        "continent", "ocean", "atmosphere of Earth", "plate tectonics",
        "earthquake", "volcano", "mountain", "river", "delta river", "glacier",
        "desert", "rainforest", "tundra", "savanna", "island", "peninsula",
        "archipelago", "canyon", "waterfall", "lake", "groundwater",
        "Amazon River", "Nile", "Mississippi River", "Ganges", "Yangtze",
        "Himalayas", "Andes", "Rocky Mountains", "Alps", "Sahara",
        "Amazon rainforest", "Great Barrier Reef", "Grand Canyon",
        "Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic",
        "Antarctica", "Africa", "Europe", "Asia", "North America",
        "South America", "Australia", "Japan", "Brazil", "Canada", "Egypt",
        "Kenya", "Norway", "New Zealand", "Iceland", "Madagascar",
        "urbanization", "population density", "cartography", "latitude",
        "longitude", "tropics", "equator", "monsoon", "Gulf Stream",
    ],
    "history": [
        "Neolithic", "Bronze Age", "Iron Age", "Ancient Egypt", "Mesopotamia",
        "Indus Valley Civilisation", "Ancient Greece", "Roman Empire",
        "Han dynasty", "Maurya Empire", "Persian Empire", "Maya civilization",
        "Inca Empire", "Aztec Empire", "Viking Age", "Middle Ages",
        "Byzantine Empire", "Islamic Golden Age", "Mongol Empire",
        "Renaissance", "Age of Discovery", "Protestant Reformation",
        "Scientific Revolution", "Industrial Revolution", "French Revolution",
        "American Revolution", "Haitian Revolution", "Meiji Restoration",
        "World War I", "World War II", "Cold War", "decolonization",
        "Atlantic slave trade", "Silk Road", "printing press history",
        "Magna Carta", "Treaty of Versailles", "United Nations history",
        "space race", "fall of the Berlin Wall", "Apartheid",
        "Civil Rights Movement", "women's suffrage", "Russian Revolution",
        "Ottoman Empire", "British Empire", "Spanish Empire", "Holy Roman Empire",
        "Peloponnesian War", "Punic Wars", "Crusades", "Black Death",
        "American Civil War", "Napoleonic Wars", "October Revolution",
        "partition of India", "Korean War", "Vietnam War", "Cuban Missile Crisis",
    ],
    "economics": [
        "supply and demand", "market economy", "planned economy", "mixed economy",
        "capitalism", "socialism", "inflation", "deflation", "unemployment",
        "gross domestic product", "interest rate", "central bank",
        "monetary policy", "fiscal policy", "taxation", "international trade",
        "comparative advantage", "tariff", "free trade", "globalization",
        "stock market", "bond finance", "bank", "money", "currency",
        "exchange rate", "cryptocurrency", "poverty", "income inequality",
        "minimum wage", "labor market", "productivity", "recession",
        "economic depression", "Great Depression", "Keynesian economics",
        "Adam Smith", "microeconomics", "macroeconomics", "opportunity cost",
        "elasticity economics", "externality", "public good economics",
        "monopoly", "oligopoly", "perfect competition", "game theory economics",
        "behavioral economics", "development economics", "human capital",
        "gross national income", "consumer price index", "purchasing power parity",
        "World Bank", "International Monetary Fund", "World Trade Organization",
        "supply chain", "entrepreneurship", "investment", "savings",
    ],
    "civics": [
        "democracy", "republic", "constitution", "rule of law", "separation of powers",
        "checks and balances", "legislature", "executive (government)",
        "judiciary", "election", "voting", "political party", "federalism",
        "human rights", "civil liberties", "freedom of speech", "freedom of the press",
        "due process", "citizenship", "jury", "supreme court", "parliament",
        "congress", "president", "prime minister", "local government",
        "public policy", "civil society", "non-governmental organization",
        "United Nations", "Universal Declaration of Human Rights",
        "International Court of Justice", "bill of rights", "impeachment",
        "referendum", "proportional representation", "first-past-the-post",
        "lobbying", "corruption", "transparency politics", "civic education",
        "rule of law", "habeas corpus", "equal protection", "naturalization",
        "census", "taxation government", "public administration", "bureaucracy",
        "treaty", "sovereignty", "nationalism", "federal government",
        "municipal government", "civil rights", "political science",
        "social contract", "Magna Carta civics", "judicial review",
    ],
    "technology": [
        "computer", "internet", "World Wide Web", "semiconductor", "transistor",
        "integrated circuit", "microprocessor", "smartphone", "artificial intelligence",
        "machine learning", "robotics", "software", "operating system",
        "database", "cloud computing", "encryption", "cybersecurity",
        "computer network", "Wi-Fi", "Bluetooth", "GPS", "satellite",
        "electric vehicle", "lithium-ion battery", "solar cell", "3D printing",
        "nanotechnology", "biotechnology", "CRISPR technology", "quantum computing",
        "virtual reality", "augmented reality", "blockchain", "email",
        "search engine", "social media", "programming language", "Python programming",
        "algorithm", "data structure", "compiler", "open-source software",
        "steam engine", "internal combustion engine", "jet engine", "airplane",
        "rail transport", "telephone", "radio", "television", "camera",
        "printing", "laser technology", "fiber-optic communication",
        "automation", "Internet of things", "drone", "spaceflight",
        "International Space Station", "Hubble Space Telescope",
    ],
    "environment": [
        "climate change", "global warming", "greenhouse effect", "carbon dioxide",
        "carbon cycle", "deforestation", "desertification", "biodiversity loss",
        "endangered species", "conservation biology", "national park",
        "renewable energy", "fossil fuel", "air pollution", "water pollution",
        "plastic pollution", "ocean acidification", "sea level rise",
        "ozone depletion", "acid rain", "recycling", "waste management",
        "sustainable development", "ecological footprint", "overfishing",
        "habitat destruction", "invasive species", "wetland", "reforestation",
        "afforestation", "compost", "circular economy", "Paris Agreement",
        "Intergovernmental Panel on Climate Change", "Kyoto Protocol",
        "renewable resource", "non-renewable resource", "hydropower",
        "wind power", "solar energy", "geothermal energy", "biofuel",
        "carbon capture", "methane", "permafrost", "coral bleaching",
        "wildfire", "drought", "flood", "hurricane", "El Nino",
        "environmental policy", "Clean Air Act", "water scarcity",
        "soil erosion", "pesticide environmental impact", "urban heat island",
    ],
    "sports": [
        "Olympic Games", "association football", "basketball", "cricket",
        "tennis", "baseball", "volleyball", "rugby football", "ice hockey",
        "field hockey", "golf", "athletics sport", "marathon", "swimming",
        "gymnastics", "boxing", "wrestling", "judo", "taekwondo", "karate",
        "fencing", "archery", "shooting sport", "cycling", "skiing",
        "snowboarding", "figure skating", "speed skating", "rowing",
        "canoeing", "sailing", "surfing", "skateboarding", "climbing",
        "table tennis", "badminton", "handball", "water polo", "triathlon",
        "Formula One", "NASCAR", "Tour de France", "FIFA World Cup",
        "UEFA Champions League", "Super Bowl", "World Series", "Wimbledon",
        "Tour de France cycling", "Paralympic Games", "Commonwealth Games",
        "sportsmanship", "offside association football", "penalty kick",
        "decathlon", "heptathlon", "biathlon", "curling", "lacrosse",
        "American football", "Australian rules football", "sumo",
        "mixed martial arts", "weightlifting", "horse racing",
    ],
    "education": [
        "education", "literacy", "numeracy", "curriculum", "pedagogy",
        "kindergarten", "primary education", "secondary education",
        "higher education", "university", "vocational education",
        "distance education", "e-learning", "Montessori education",
        "special education", "inclusive education", "standardized test",
        "SAT", "Programme for International Student Assessment",
        "Bloom's taxonomy", "constructivism learning", "critical thinking",
        "homework", "classroom", "teacher", "student", "scholarship",
        "academic degree", "bachelor's degree", "PhD", "library science",
        "preschool", "homeschooling", "adult education", "lifelong learning",
        "STEM education", "liberal arts", "grammar school", "boarding school",
        "charter school", "public school", "private school", "community college",
        "educational psychology", "learning disability", "dyslexia",
        "attention deficit hyperactivity disorder education", "tutoring",
        "lecture", "seminar", "laboratory education", "apprenticeship",
        "UNESCO education", "compulsory education", "school discipline",
        "student assessment", "grade point average", "academic journal",
        "research university", "study skills", "note-taking",
    ],
    "culture": [
        "culture", "mythology", "folklore", "literature", "poetry", "novel",
        "drama", "theatre", "opera", "ballet", "dance", "music", "jazz",
        "classical music", "orchestra", "piano", "guitar", "painting",
        "sculpture", "architecture culture", "photography", "cinema",
        "animation", "museum", "festival", "ritual", "tradition",
        "cuisine", "fashion", "calligraphy", "ceramics", "folk music",
        "epic poetry", "Shakespeare", "Homer", "Mahabharata", "One Thousand and One Nights",
        "Renaissance art", "Impressionism", "modernism", "Cubism",
        "surrealism", "Baroque", "Romanticism", "Gothic art",
        "Japanese tea ceremony", "Carnival", "Diwali", "Ramadan",
        "Chinese New Year", "Olympic symbols", "UNESCO Intangible Cultural Heritage",
        "world heritage", "oral tradition", "proverb", "language family culture",
        "cinema of India", "Hollywood", "Nollywood", "K-pop",
        "hip hop", "blues", "rock music", "symphony", "sonnet",
    ],
    "general": [
        "mathematics", "algebra", "geometry", "calculus", "statistics",
        "probability", "number", "prime number", "pi", "infinity",
        "set theory", "logic", "philosophy", "ethics", "epistemology",
        "metaphysics", "stoicism", "existentialism", "psychology",
        "cognition", "memory", "emotion", "sleep", "nutrition",
        "vitamin", "vaccine public health", "public health", "medicine",
        "surgery", "antibiotic", "anatomy overview", "architecture",
        "bridge", "skyscraper", "concrete", "steel", "transport",
        "ship", "railway", "aircraft", "bicycle", "language",
        "alphabet", "writing system", "grammar", "linguistics",
        "religion", "Buddhism", "Christianity", "Islam", "Hinduism",
        "Judaism", "Sikhism", "time", "calendar", "map", "library",
        "newspaper", "coffee", "tea", "bread", "rice", "agriculture",
        "measurement", "International System of Units", "clock",
    ],
}

TITLE_SKIP_SUBSTRINGS = (
    "f.c.",
    "afc ",
    " a.f.C",
    "football club",
    " soccer club",
    " squad",
    " roster",
)

# Exact Wikipedia titles that student/essay drafts use as headings.
# Aliases keep "# Hard work" and "American History" on the canonical article.
PINNED_TITLES: list[tuple[str, str, list[str]]] = [
    ("Technology", "technology", []),
    ("Success", "general", []),
    ("History", "history", []),
    ("Climate change", "environment", ["Climate Change"]),
    ("Friendship", "culture", []),
    ("Nature", "environment", []),
    ("Creativity", "culture", []),
    ("Discipline", "general", []),
    ("Time", "general", []),
    ("Leadership", "civics", []),
    ("Diligence", "general", ["Hard work"]),
    ("Failure", "general", []),
    ("Happiness", "general", []),
    ("Health", "general", []),
    ("Internet", "technology", ["The Internet"]),
    ("Social media", "technology", ["Social Media"]),
    ("Science", "general", []),
    ("Culture", "culture", []),
    ("Sport", "sports", ["Sports"]),
    ("Economics", "economics", ["Economy"]),
    ("Democracy", "civics", []),
    ("Mathematics", "general", []),
    ("Philosophy", "general", []),
    ("Motivation", "general", []),
    ("Communication", "general", []),
    ("Globalization", "economics", []),
    ("Pollution", "environment", []),
    ("Love", "culture", []),
    ("Family", "culture", []),
    ("Knowledge", "education", []),
    ("Intelligence", "general", []),
    ("Society", "civics", []),
    ("Government", "civics", []),
    ("Law", "civics", []),
    ("Art", "culture", []),
    ("Music", "culture", []),
    ("Literature", "culture", []),
    ("War", "history", []),
    ("Peace", "civics", []),
    ("Freedom", "civics", []),
    ("Justice", "civics", []),
    ("Poverty", "economics", []),
    ("Unemployment", "economics", []),
    ("Tourism", "economics", []),
    ("Agriculture", "economics", []),
    ("Energy", "environment", []),
    ("Water", "environment", []),
    ("Air pollution", "environment", []),
    ("Recycling", "environment", []),
    ("Biodiversity", "environment", []),
    ("Evolution", "biology", []),
    ("Computer", "technology", []),
    ("Smartphone", "technology", []),
    ("Education", "education", []),
    ("University", "education", []),
    ("Student", "education", []),
    ("Teacher", "education", []),
    ("Business", "economics", []),
    ("Marketing", "economics", []),
    ("E-commerce", "economics", ["Electronic commerce", "E-Commerce"]),
    ("History of the United States", "history", ["American History", "American history"]),
    ("Artificial intelligence", "technology", ["AI"]),
    ("Physics", "physics", []),
    ("Chemistry", "chemistry", []),
    ("Biology", "biology", []),
    ("Geography", "geography", []),
    ("Psychology", "general", []),
    ("Medicine", "general", []),
    ("Religion", "culture", []),
    ("Language", "culture", []),
    ("Writing", "culture", []),
    ("Reading", "education", []),
    ("Homework", "education", []),
    ("School", "education", []),
    ("Climate", "environment", []),
    ("Weather", "environment", []),
    ("Forest", "environment", []),
    ("Ocean", "geography", []),
    ("River", "geography", []),
    ("City", "geography", []),
    ("Country", "civics", []),
    ("Human rights", "civics", []),
    ("Constitution", "civics", []),
    ("Election", "civics", []),
    ("Money", "economics", []),
    ("Trade", "economics", []),
    ("Inflation", "economics", []),
    ("Bank", "economics", []),
    ("Computer science", "technology", []),
    ("Software", "technology", []),
    ("Robot", "technology", []),
    ("Robotics", "technology", []),
    ("Space exploration", "physics", []),
    ("Solar System", "physics", []),
    ("Earth", "geography", []),
    ("Natural environment", "environment", ["The Environment", "Environment"]),
]


def topic_quotas(total: int) -> dict[str, int]:
    base, extra = divmod(total, len(TOPIC_ORDER))
    quotas = {}
    for i, topic in enumerate(TOPIC_ORDER):
        quotas[topic] = base + (1 if i < extra else 0)
    return quotas


def normalize_title(title: str) -> str:
    text = unicodedata.normalize("NFKC", title).lower().replace("_", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def significant_tokens(title: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", normalize_title(title))
    out: set[str] = set()
    roman = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"}
    for token in tokens:
        if token in STOPWORDS:
            continue
        if token.isdigit() or token in roman or len(token) > 2:
            out.add(token)
    return out


def is_near_duplicate(title: str, existing: list[set[str]], existing_keys: set[str]) -> bool:
    key = normalize_title(title)
    if key in existing_keys:
        return True
    key_no_paren = re.sub(r"\s*\([^)]*\)\s*", " ", key).strip()
    key_no_paren = re.sub(r"\s+", " ", key_no_paren)
    # If the main article is already collected, skip "Topic (qualifier)" variants
    # of that same title. Distinct qualifiers (planet vs element) are compared
    # later via token overlap.
    if "(" in title and key_no_paren and key_no_paren in existing_keys:
        return True
    tokens = significant_tokens(title)
    if len(tokens) < 2:
        return False
    for other in existing:
        if len(other) < 2:
            continue
        overlap = tokens & other
        smaller = min(len(tokens), len(other))
        if len(overlap) >= 2 and len(overlap) / smaller >= 0.85:
            return True
        if tokens <= other or other <= tokens:
            if smaller >= 3:
                return True
    return False


def should_skip_title(title: str) -> bool:
    lowered = title.lower().strip()
    if SKIP_TITLE_RE.search(lowered):
        return True
    if any(part in lowered for part in TITLE_SKIP_SUBSTRINGS):
        return True
    if re.fullmatch(r"\d{1,4}", title.strip()):
        return True
    if re.fullmatch(
        r"\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)",
        title,
        flags=re.I,
    ):
        return True
    return False


def should_skip_extract(extract: str) -> bool:
    text = extract.strip()
    if len(text) < MIN_EXTRACT_CHARS:
        return True
    head = text[:600].lower()
    if "may refer to:" in head or "may also refer to:" in head:
        return True
    if "is a disambiguation page" in head:
        return True
    if text.lower().startswith("redirect"):
        return True
    return False


def strip_nav_sections(text: str) -> str:
    markers = (
        "\nSee also\n",
        "\nReferences\n",
        "\nExternal links\n",
        "\nFurther reading\n",
        "\nNotes\n",
    )
    out = text.strip()
    lowered = out.lower()
    cut_at = None
    for marker in markers:
        index = lowered.find(marker.lower())
        if index >= 400:
            cut_at = index if cut_at is None else min(cut_at, index)
    if cut_at is not None:
        out = out[:cut_at].strip()
    return out


def store_excerpt(text: str, max_chars: int = STORE_MAX_CHARS) -> str:
    cleaned = strip_nav_sections(text)
    if len(cleaned) <= max_chars:
        return cleaned
    snippet = cleaned[:max_chars]
    paragraph = snippet.rfind("\n\n")
    sentence = snippet.rfind(". ")
    cut = max(paragraph, sentence)
    if cut >= 500:
        return snippet[: sentence + 1 if sentence == cut else cut].strip()
    return snippet.strip()


class WikiClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "Accept-Language": "en",
            }
        )
        self._last_request = 0.0

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request
        if elapsed < REQUEST_DELAY_SECONDS:
            time.sleep(REQUEST_DELAY_SECONDS - elapsed)

    def get(self, params: dict[str, Any]) -> dict[str, Any]:
        query = {
            "format": "json",
            "formatversion": "2",
            "utf8": 1,
            "maxlag": 5,
            **params,
        }
        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            self._throttle()
            try:
                response = self.session.get(API_URL, params=query, timeout=TIMEOUT_SECONDS)
                self._last_request = time.monotonic()
                retry_after = response.headers.get("Retry-After")
                if response.status_code in {429, 500, 502, 503, 504}:
                    wait = _retry_wait(attempt, retry_after)
                    print(f"  HTTP {response.status_code}; retry {attempt}/{MAX_RETRIES} in {wait:.1f}s")
                    time.sleep(wait)
                    continue
                response.raise_for_status()
                data = response.json()
                error = data.get("error")
                if error:
                    code = str(error.get("code", ""))
                    if code in {"maxlag", "ratelimited", "readonly"}:
                        wait = _retry_wait(attempt, retry_after, default=5.0)
                        print(f"  API {code}; retry {attempt}/{MAX_RETRIES} in {wait:.1f}s")
                        time.sleep(wait)
                        continue
                    raise RuntimeError(f"MediaWiki API error: {error}")
                return data
            except (requests.RequestException, ValueError, RuntimeError) as exc:
                last_error = exc
                wait = _retry_wait(attempt, None)
                print(f"  Request failed ({exc}); retry {attempt}/{MAX_RETRIES} in {wait:.1f}s")
                time.sleep(wait)
        raise RuntimeError(f"Request failed after {MAX_RETRIES} retries: {last_error}")

    def search_titles(self, query: str, limit: int = 8) -> list[str]:
        data = self.get(
            {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srnamespace": 0,
                "srlimit": limit,
                "srqiprofile": "classic_noboostlinks",
            }
        )
        titles = []
        for hit in data.get("query", {}).get("search", []):
            title = hit.get("title") or ""
            if title and not should_skip_title(title):
                titles.append(title)
        return titles

    def category_members(self, category: str, member_type: str, limit: int) -> list[str]:
        titles: list[str] = []
        cont: dict[str, Any] = {}
        while len(titles) < limit:
            params: dict[str, Any] = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": category,
                "cmtype": member_type,
                "cmnamespace": 14 if member_type == "subcat" else 0,
                "cmlimit": min(100, limit - len(titles)),
            }
            params.update(cont)
            data = self.get(params)
            members = data.get("query", {}).get("categorymembers", [])
            for member in members:
                title = member.get("title") or ""
                if title:
                    titles.append(title)
            cont_token = data.get("continue")
            if not cont_token:
                break
            cont = cont_token
        return titles

    def random_titles(self, limit: int = 20) -> list[str]:
        data = self.get(
            {
                "action": "query",
                "list": "random",
                "rnnamespace": 0,
                "rnlimit": min(limit, 20),
            }
        )
        titles = []
        for item in data.get("query", {}).get("random", []):
            title = item.get("title") or ""
            if title and not should_skip_title(title):
                titles.append(title)
        return titles

    def fetch_article(self, title: str, *, allow_skipped_title: bool = False) -> dict[str, Any] | None:
        data = self.get(
            {
                "action": "query",
                "prop": "extracts|info|pageprops|categories",
                "explaintext": 1,
                "exsectionformat": "plain",
                "inprop": "url",
                "ppprop": "disambiguation",
                "cllimit": 80,
                "clshow": "!hidden",
                "redirects": 1,
                "titles": title,
            }
        )
        pages = data.get("query", {}).get("pages", [])
        if not pages:
            return None
        page = pages[0]
        if page.get("missing") or page.get("invalid"):
            return None
        if "pageprops" in page and "disambiguation" in (page.get("pageprops") or {}):
            return None
        categories = [c.get("title", "") for c in page.get("categories", [])]
        if any("disambiguation" in cat.lower() for cat in categories):
            return None
        if any(cat.lower().endswith("lists") or " list articles" in cat.lower() for cat in categories):
            return None
        extract = page.get("extract") or ""
        if should_skip_extract(extract):
            return None
        canonical_title = page.get("title") or title
        if should_skip_title(canonical_title) and not allow_skipped_title:
            return None
        url = page.get("fullurl") or article_url(canonical_title)
        return {
            "pageid": page.get("pageid"),
            "title": canonical_title,
            "extract": extract.strip(),
            "url": url,
        }


def _retry_wait(attempt: int, retry_after: str | None, default: float = 1.0) -> float:
    if retry_after:
        try:
            return max(float(retry_after), 1.0)
        except ValueError:
            pass
    return min(default * (2 ** (attempt - 1)), 30.0)


def article_url(title: str) -> str:
    return ARTICLE_URL_PREFIX + quote(title.replace(" ", "_"), safe="()!,;:@$'*+")


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def progress(message: str) -> None:
    try:
        print(message, flush=True)
    except UnicodeEncodeError:
        print(message.encode("ascii", "backslashreplace").decode("ascii"), flush=True)


def gather_candidates(client: WikiClient, topic: str, needed: int) -> list[str]:
    seen: set[str] = set()
    priority: list[str] = []
    backup: list[str] = []

    def add(title: str, bucket: list[str]) -> None:
        key = normalize_title(title)
        if not key or key in seen or should_skip_title(title):
            return
        seen.add(key)
        bucket.append(title)

    progress(f"  Collecting candidate titles for {topic}...")
    for seed in SEARCH_SEEDS.get(topic, []):
        try:
            for title in client.search_titles(seed, limit=3):
                add(title, priority)
        except RuntimeError as exc:
            progress(f"  Search skipped for {seed!r}: {exc}")
        if len(priority) >= needed + 80:
            break

    if len(priority) < needed + 80:
        for category in TOPIC_CATEGORIES.get(topic, []):
            try:
                pages = client.category_members(category, "page", limit=160)
                random.shuffle(pages)
                for title in pages:
                    add(title, backup)
                if len(priority) + len(backup) < needed * 4:
                    subcats = client.category_members(category, "subcat", limit=30)
                    random.shuffle(subcats)
                    for subcat in subcats[:12]:
                        if SKIP_SUBCAT_RE.search(subcat):
                            continue
                        sub_pages = client.category_members(subcat, "page", limit=50)
                        random.shuffle(sub_pages)
                        for title in sub_pages:
                            add(title, backup)
            except RuntimeError as exc:
                progress(f"  Category skipped {category}: {exc}")
            if len(priority) + len(backup) >= needed * 5:
                break

    random.shuffle(priority)
    random.shuffle(backup)
    candidates = priority + backup
    progress(
        f"  {len(candidates)} candidate titles for {topic} "
        f"({len(priority)} search, {len(backup)} category)"
    )
    return candidates


def load_existing_articles(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    rows: list[dict[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(raw, dict):
            continue
        topic = raw.get("topic")
        text = raw.get("source_text")
        url = raw.get("source_url")
        category = raw.get("category")
        if not all(isinstance(value, str) and value.strip() for value in (topic, text, url, category)):
            continue
        assert isinstance(topic, str) and isinstance(text, str)
        assert isinstance(url, str) and isinstance(category, str)
        excerpt = store_excerpt(text)
        if len(excerpt) < MIN_EXTRACT_CHARS:
            continue
        record: dict[str, str] = {
            "topic": topic.strip(),
            "source_text": excerpt,
            "source_url": url.strip(),
            "category": category.strip(),
        }
        aliases = raw.get("aliases")
        if isinstance(aliases, list):
            cleaned = [item.strip() for item in aliases if isinstance(item, str) and item.strip()]
            if cleaned:
                record["aliases"] = json.dumps(cleaned)
                record["_aliases"] = "\n".join(cleaned)
        rows.append(record)
    return rows


def aliases_of(row: dict[str, str]) -> list[str]:
    packed = row.get("_aliases")
    if packed:
        return [item for item in packed.split("\n") if item]
    raw = row.get("aliases")
    if not raw:
        return []
    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, str)]
    return []


def set_aliases(row: dict[str, str], aliases: list[str]) -> None:
    unique: list[str] = []
    seen = {normalize_title(row["topic"])}
    for alias in aliases:
        key = normalize_title(alias)
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(alias.strip())
    if unique:
        row["_aliases"] = "\n".join(unique)
    else:
        row.pop("_aliases", None)
        row.pop("aliases", None)


def merge_aliases(row: dict[str, str], extras: list[str]) -> None:
    set_aliases(row, [*aliases_of(row), *extras])


def index_existing(articles: list[dict[str, str]]) -> tuple[set[str], set[str], list[set[str]], Counter]:
    urls = {row["source_url"] for row in articles}
    title_keys: set[str] = set()
    token_sets: list[set[str]] = []
    counts: Counter = Counter()
    for row in articles:
        title_keys.add(normalize_title(row["topic"]))
        for alias in aliases_of(row):
            title_keys.add(normalize_title(alias))
        token_sets.append(significant_tokens(row["topic"]))
        counts[row["category"]] += 1
    return urls, title_keys, token_sets, counts


def collect_articles(
    total: int,
    existing: list[dict[str, str]] | None = None,
    checkpoint_path: Path | None = None,
) -> list[dict[str, str]]:
    random.seed()
    quotas = topic_quotas(total)
    client = WikiClient()
    articles: list[dict[str, str]] = list(existing or [])
    urls, title_keys, token_sets, counts = index_existing(articles)
    page_ids: set[int] = set()

    def checkpoint() -> None:
        if checkpoint_path and len(articles) % CHECKPOINT_EVERY == 0:
            write_jsonl(checkpoint_path, articles)
            progress(f"  checkpoint {len(articles)} rows -> {checkpoint_path.name}")

    def accept(
        article: dict[str, Any],
        category: str,
        extra_aliases: list[str] | None = None,
        *,
        pinned: bool = False,
    ) -> bool:
        pageid = article.get("pageid")
        canonical = str(article["title"])
        url = str(article["url"])
        if pageid in page_ids or url in urls:
            existing_row = next((row for row in articles if row["source_url"] == url), None)
            if existing_row and extra_aliases:
                merge_aliases(existing_row, extra_aliases)
            return False
        if not pinned:
            if is_near_duplicate(canonical, token_sets, title_keys):
                return False
            if should_skip_title(canonical):
                return False
        excerpt = store_excerpt(str(article["extract"]))
        if len(excerpt) < MIN_EXTRACT_CHARS:
            return False
        record = {
            "topic": canonical,
            "source_text": excerpt,
            "source_url": url,
            "category": category,
        }
        extras = list(extra_aliases or [])
        if normalize_title(canonical) != normalize_title(str(article.get("requested") or canonical)):
            requested = article.get("requested")
            if isinstance(requested, str) and requested.strip():
                extras.append(requested.strip())
        merge_aliases(record, extras)
        articles.append(record)
        if isinstance(pageid, int):
            page_ids.add(pageid)
        urls.add(url)
        title_keys.add(normalize_title(canonical))
        for alias in aliases_of(record):
            title_keys.add(normalize_title(alias))
        token_sets.append(significant_tokens(canonical))
        counts[category] += 1
        progress(
            f"[{len(articles)}/{total}] {category} | {canonical} | "
            f"{len(record['source_text'])} chars"
        )
        checkpoint()
        return True

    progress(f"Collecting {total} unique English Wikipedia articles via {API_URL}")
    progress(f"Starting from {len(articles)} stored articles")
    progress("Topic quotas: " + ", ".join(f"{k}={v}" for k, v in quotas.items()))
    progress("")

    progress("Pinning common essay titles...")
    for title, category, extra_aliases in PINNED_TITLES:
        if len(articles) >= total:
            break
        if normalize_title(title) in title_keys:
            existing_row = next(
                (
                    row
                    for row in articles
                    if normalize_title(row["topic"]) == normalize_title(title)
                    or normalize_title(title) in {normalize_title(alias) for alias in aliases_of(row)}
                ),
                None,
            )
            if existing_row:
                merge_aliases(existing_row, [title, *extra_aliases])
            continue
        try:
            article = client.fetch_article(title, allow_skipped_title=True)
        except RuntimeError as exc:
            progress(f"  Failed pinned {title}: {exc}")
            continue
        if not article:
            progress(f"  Skipped pinned {title}")
            continue
        article["requested"] = title
        accept(article, category, [title, *extra_aliases], pinned=True)

    for topic, quota in quotas.items():
        if len(articles) >= total:
            break
        remaining = quota - counts[topic]
        if remaining <= 0:
            continue
        candidates = gather_candidates(client, topic, remaining)
        candidate_index = 0
        random_rounds = 0
        while counts[topic] < quota and len(articles) < total:
            title = None
            if candidate_index < len(candidates):
                title = candidates[candidate_index]
                candidate_index += 1
            else:
                if random_rounds >= 80:
                    progress(f"  Stopping {topic} at {counts[topic]}/{quota}; moving on")
                    break
                random_rounds += 1
                extras = client.random_titles(20)
                for extra in extras:
                    if normalize_title(extra) not in title_keys:
                        candidates.append(extra)
                if candidate_index >= len(candidates):
                    continue
                title = candidates[candidate_index]
                candidate_index += 1

            if is_near_duplicate(title, token_sets, title_keys):
                continue
            try:
                article = client.fetch_article(title)
            except RuntimeError as exc:
                progress(f"  Failed {title}: {exc}")
                continue
            if not article:
                continue
            accept(article, topic)

    # Fill leftover slots from any topic if some quotas ran short.
    leftover_rounds = 0
    while len(articles) < total:
        leftover_rounds += 1
        if leftover_rounds > 120:
            raise RuntimeError(f"Could not reach {total} articles (have {len(articles)})")
        for extra in client.random_titles(20):
            if len(articles) >= total:
                break
            if is_near_duplicate(extra, token_sets, title_keys):
                continue
            try:
                article = client.fetch_article(extra)
            except RuntimeError:
                continue
            if not article:
                continue
            category = "general"
            accept(article, category)

    return articles[:total]


def validate_articles(articles: list[dict[str, str]], total: int) -> None:
    if len(articles) != total:
        raise SystemExit(f"Validation failed: expected {total} articles, got {len(articles)}")
    titles = [row["topic"] for row in articles]
    urls = [row["source_url"] for row in articles]
    texts = [row["source_text"] for row in articles]
    if len(set(normalize_title(t) for t in titles)) != total:
        raise SystemExit("Validation failed: duplicate titles found")
    if len(set(urls)) != total:
        raise SystemExit("Validation failed: duplicate source URLs found")
    if any(not text.strip() or len(text.strip()) < MIN_EXTRACT_CHARS for text in texts):
        raise SystemExit("Validation failed: empty or too-short extracts found")
    if any(not url.startswith("https://en.wikipedia.org/wiki/") for url in urls):
        raise SystemExit("Validation failed: missing or invalid source URL")
    if any(should_skip_title(title) for title in titles):
        raise SystemExit("Validation failed: a skipped-title pattern slipped through")


def write_jsonl(path: Path, articles: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in articles:
            payload: dict[str, Any] = {
                "topic": row["topic"],
                "source_text": row["source_text"],
                "source_url": row["source_url"],
                "category": row["category"],
            }
            extra = aliases_of(row)
            if extra:
                payload["aliases"] = extra
            handle.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
            handle.write("\n")


def write_xlsx(path: Path, articles: list[dict[str, str]]) -> int:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "wikipedia_3000"
    headers = ["topic", "source_text", "source_url"]
    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    truncated = 0
    wrap = Alignment(wrap_text=True, vertical="top")
    for row in articles:
        text = row["source_text"]
        if len(text) > EXCEL_MAX_CELL:
            text = _truncate_for_excel(text)
            truncated += 1
        sheet.append([row["topic"], text, row["source_url"]])
        for cell in sheet[sheet.max_row]:
            cell.alignment = wrap
    sheet.column_dimensions["A"].width = 40
    sheet.column_dimensions["B"].width = 80
    sheet.column_dimensions["C"].width = 50
    sheet.freeze_panes = "A2"
    workbook.save(path)
    return truncated


def _truncate_for_excel(text: str) -> str:
    limit = EXCEL_MAX_CELL
    snippet = text[:limit]
    cut = snippet.rfind("\n")
    if cut >= MIN_EXTRACT_CHARS:
        return snippet[:cut].rstrip()
    return snippet.rstrip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=TARGET_COUNT)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data",
    )
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="Ignore the existing JSONL and collect from scratch.",
    )
    return parser.parse_args()


def main() -> int:
    configure_stdio()
    args = parse_args()
    if args.count != TARGET_COUNT:
        print(f"Note: collecting {args.count} articles (default is {TARGET_COUNT})")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    jsonl_path = args.output_dir / "wikipedia_750.jsonl"
    xlsx_path = args.output_dir / "wikipedia_750.xlsx"

    existing: list[dict[str, str]] = []
    if not args.fresh:
        existing = load_existing_articles(jsonl_path)
        if existing:
            print(f"Resuming from {len(existing)} articles in {jsonl_path.name}")

    articles = collect_articles(args.count, existing, checkpoint_path=jsonl_path)
    validate_articles(articles, args.count)
    write_jsonl(jsonl_path, articles)
    truncated = write_xlsx(xlsx_path, articles)

    counts = Counter(row["category"] for row in articles)
    print()
    print("Collection complete.")
    print(f"Validated unique articles: {len(articles)}")
    print("Per-category counts:")
    for topic in TOPIC_ORDER:
        print(f"  {topic}: {counts[topic]}")
    print(f"JSONL: {jsonl_path}")
    print(f"Excel: {xlsx_path}")
    if truncated:
        print(
            f"Note: {truncated} Excel rows were trimmed to the 32,767-character "
            "cell limit. Full stored text is in the JSONL file."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
