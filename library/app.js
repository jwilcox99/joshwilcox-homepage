const API_URL = "https://script.google.com/macros/s/AKfycbzHY0oyoG30CjNb02V4Dtz2rLpjOwb1KMt55MtjZZU-sr58ugWtO3EvGYbqjE99wlSj/exec";

const form = document.getElementById("bookForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitBook");
const scannerDiv = document.getElementById("scanner");

const homeScreen = document.getElementById("homeScreen");
const addBookScreen = document.getElementById("addBookScreen");
const libraryScreen = document.getElementById("libraryScreen");
const favoritesScreen = document.getElementById("favoritesScreen");

const homeScanButton = document.getElementById("homeScanButton");
const homeAddButton = document.getElementById("homeAddButton");
const homeLibraryButton = document.getElementById("homeLibraryButton");
const homeFavoritesButton = document.getElementById("homeFavoritesButton");

const backFromAdd = document.getElementById("backFromAdd");
const backFromLibrary = document.getElementById("backFromLibrary");
const backFromFavorites = document.getElementById("backFromFavorites");

const librarySearch = document.getElementById("librarySearch");
const libraryList = document.getElementById("libraryList");
const favoritesList = document.getElementById("favoritesList");

const detailScreen = document.getElementById("detailScreen");
const backFromDetail = document.getElementById("backFromDetail");
const bookDetail = document.getElementById("bookDetail");

let previousScreen = "library";
let html5QrCode = null;
let scanInProgress = false;
let allBooks = [];

function showScreen(name) {
  homeScreen.classList.add("hidden");
  addBookScreen.classList.add("hidden");
  libraryScreen.classList.add("hidden");
  favoritesScreen.classList.add("hidden");
  detailScreen.classList.add("hidden");

  if (name === "detail") detailScreen.classList.remove("hidden");
  if (name === "home") homeScreen.classList.remove("hidden");
  if (name === "add") addBookScreen.classList.remove("hidden");
  if (name === "library") libraryScreen.classList.remove("hidden");
  if (name === "favorites") favoritesScreen.classList.remove("hidden");
}

function cleanIsbn(value) {
  return String(value || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

function looksLikeIsbn(isbn) {
  const cleaned = cleanIsbn(isbn);
  return (cleaned.length === 13 && (cleaned.startsWith("978") || cleaned.startsWith("979"))) || cleaned.length === 10;
}

function guessGenreFromBook(data) {
  const parts = [
    ...(data.subjects || []),
    data.subtitle || "",
    data.title || "",
    typeof data.description === "string"
      ? data.description
      : data.description?.value || ""
  ];

  const text = parts.join(" ").toLowerCase();

  const scores = {};

  function add(genre, points, terms) {
    terms.forEach(term => {
      if (text.includes(term)) {
        scores[genre] = (scores[genre] || 0) + points;
      }
    });
  }

  add("Graphic Novel", 100, ["graphic novel", "graphic novels", "manga"]);
  add("Graphic Novel", 75, ["comic book", "comics"]);

  add("Young Adult", 100, ["young adult", "ya fiction"]);
  add("Young Adult", 70, ["teen fiction", "juvenile fiction"]);

  add("Historical Romance", 120, ["historical romance", "regency romance"]);
  add("Historical Romance", 45, ["duke", "earl", "regency", "victorian"]);

  add("Romantasy", 120, ["romantasy", "fantasy romance"]);
  if (text.includes("fantasy") && text.includes("romance")) {
    scores["Romantasy"] = (scores["Romantasy"] || 0) + 90;
  }
  add("Romantasy", 35, ["fae", "faerie", "dragon", "magic court"]);

  add("Historical Fiction", 100, ["historical fiction"]);
  add("Science Fiction", 100, ["science fiction", "sci-fi", "space opera"]);
  add("Fantasy", 80, ["fantasy", "magic", "dragon", "wizard"]);
  add("Mystery", 90, ["mystery", "detective", "whodunit"]);
  add("Thriller", 90, ["thriller", "suspense"]);
  add("Horror", 90, ["horror", "ghost", "haunted"]);
  add("Romance", 80, ["romance", "love story"]);
  add("Biography", 90, ["biography", "autobiography"]);
  add("Memoir", 90, ["memoir"]);
  add("History", 80, ["history"]);
  add("Business", 80, ["business", "leadership", "management"]);
  add("Self-Help", 80, ["self-help", "self help", "personal growth"]);
  add("Cookbook", 90, ["cookbook", "cookery", "cooking", "recipes"]);
  add("Travel", 80, ["travel"]);
  add("Poetry", 90, ["poetry", "poems"]);
  add("Children's", 80, ["children", "juvenile"]);
  add("Classic", 60, ["classic"]);
  add("Nonfiction", 60, ["nonfiction", "non-fiction"]);
  add("Fiction", 40, ["fiction", "novel"]);

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (!ranked.length) return "";

  const [bestGenre, score] = ranked[0];

  // Avoid weak guesses.
  if (score < 70) return "";

  return bestGenre;
}

async function loadSettings() {
  try {
    const res = await fetch(`${API_URL}?action=settings`);
    const data = await res.json();
    const settings = data.settings || {};

    fillSelect("status", settings.Status || []);
    fillSelect("location", settings.Location || settings["Shelf / Location"] || []);
    fillSelect("genre", settings.Genre || []);
    fillSelect("favorite", settings.Favorite || []);
    fillSelect("duplicateType", settings["Duplicate Type"] || []);
  } catch (err) {
    message.textContent = "Could not load settings: " + err.message;
  }
}

function fillSelect(id, values = []) {
  const select = document.getElementById(id);
  select.innerHTML = "";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "";
  select.appendChild(blank);

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

async function lookupBookByIsbn(isbn) {
  const cleaned = cleanIsbn(isbn);

  if (!looksLikeIsbn(cleaned)) {
    message.textContent = `Scanned ${cleaned}, but that does not look like an ISBN.`;
    return;
  }

  message.textContent = `Looking up ISBN ${cleaned}...`;

  const res = await fetch(`https://openlibrary.org/isbn/${cleaned}.json`);

  if (!res.ok) {
    form.elements["isbn13"].value = cleaned;
    message.textContent = `ISBN ${cleaned} not found. Enter manually.`;
    return;
  }

  const data = await res.json();

  form.elements["title"].value = data.title || "";
  form.elements["isbn13"].value = cleaned;

  let authorNames = [];

  if (data.authors && data.authors.length) {
    for (const author of data.authors) {
      try {
        const authorRes = await fetch(`https://openlibrary.org${author.key}.json`);
        if (authorRes.ok) {
          const authorData = await authorRes.json();
          if (authorData.name) authorNames.push(authorData.name);
        }
      } catch {}
    }
  }

  form.elements["authors"].value = authorNames.join(", ");
  form.elements["publisher"].value = data.publishers ? data.publishers.join(", ") : "";
  form.elements["publishedDate"].value = data.publish_date || "";
  form.elements["pageCount"].value = data.number_of_pages || "";
  form.elements["categories"].value = data.subjects ? data.subjects.slice(0, 8).join(", ") : "";
  form.elements["genre"].value = guessGenreFromBook(data);
  form.elements["coverUrl"].value = data.covers && data.covers.length ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg` : "";
  form.elements["googleBooksLink"].value = `https://openlibrary.org/isbn/${cleaned}`;
  form.elements["description"].value = typeof data.description === "string" ? data.description : data.description?.value || "";

  message.textContent = `Found: ${data.title || "book"}${authorNames.length ? " by " + authorNames.join(", ") : ""}`;
}

async function startScanner() {
  try {
    scannerDiv.style.display = "block";
    message.textContent = "Starting camera...";

    if (!html5QrCode) html5QrCode = new Html5Qrcode("scanner");

    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      async decodedText => {
        const isbn = cleanIsbn(decodedText);
        if (!looksLikeIsbn(isbn)) {
          message.textContent = `Scanned ${isbn}, but that does not look like an ISBN.`;
          return;
        }

        await stopScanner();
        await lookupBookByIsbn(isbn);
      }
    );

    scanInProgress = true;
    message.textContent = "Point camera at the book ISBN barcode.";
  } catch (err) {
    scannerDiv.style.display = "none";
    message.textContent = "Could not start scanner: " + err.message;
  }
}

async function stopScanner() {
  if (html5QrCode && scanInProgress) await html5QrCode.stop();
  scanInProgress = false;
  scannerDiv.style.display = "none";
}

async function loadLibrary() {
  message.textContent = "Loading library...";
  const res = await fetch(`${API_URL}?action=books`);
  const data = await res.json();

  if (!data.ok) {
    message.textContent = "Could not load library.";
    return;
  }

  allBooks = data.books || [];
  renderLibrary(allBooks, libraryList);
  message.textContent = `${allBooks.length} books in The Hencox Library`;
}

function renderLibrary(books, target) {
  target.innerHTML = books.map(book => `
    <div class="book-card" data-book-id="${book["Book ID"] || ""}">
      ${book["Cover URL"] ? `<img src="${book["Cover URL"]}" alt="">` : ""}
      <div>
        <strong>${book.Title || "Untitled"}</strong>
        <div>${book.Authors || ""}</div>
        <div class="book-meta">${book.Genre || ""}${book["Shelf / Location"] ? " • " + book["Shelf / Location"] : ""}</div>
        <div class="book-meta">${book.Rating ? "⭐ " + book.Rating : ""}${book.Favorite ? " • " + book.Favorite : ""}</div>
      </div>
    </div>
  `).join("");

  target.querySelectorAll(".book-card").forEach(card => {
    card.addEventListener("click", () => {
      const bookId = card.dataset.bookId;
      const book = allBooks.find(item => item["Book ID"] === bookId);

      if (book) {
        previousScreen = target === favoritesList ? "favorites" : "library";
        showBookDetail(book);
      }
    });
  });
}

function filterLibrary() {
  const query = librarySearch.value.toLowerCase();

  const filtered = allBooks.filter(book => {
    return [
      book.Title,
      book.Authors,
      book.Genre,
      book.Status,
      book["Shelf / Location"],
      book["ISBN-13"]
    ].join(" ").toLowerCase().includes(query);
  });

  renderLibrary(filtered, libraryList);
}

function renderFavorites() {
  const favorites = allBooks.filter(book => String(book.Favorite || "").toLowerCase() === "yes");
  renderLibrary(favorites, favoritesList);
  message.textContent = `${favorites.length} favorites`;
}

async function submitBook() {
  try {
    if (!form.reportValidity()) return;

    message.textContent = "Adding book...";
    submitButton.disabled = true;

    const formData = new FormData(form);

    const book = {
      title: formData.get("title"),
      authors: formData.get("authors"),
      status: formData.get("status"),
      location: formData.get("location"),
      rating: formData.get("rating"),
      genre: formData.get("genre"),
      favorite: formData.get("favorite"),
      duplicateType: formData.get("duplicateType"),
      notes: formData.get("notes"),
      isbn13: formData.get("isbn13"),
      publisher: formData.get("publisher"),
      publishedDate: formData.get("publishedDate"),
      pageCount: formData.get("pageCount"),
      categories: formData.get("categories"),
      coverUrl: formData.get("coverUrl"),
      googleBooksLink: formData.get("googleBooksLink"),
      description: formData.get("description")
    };

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "addBook", book })
    });

    const result = await res.json();

    if (result.ok) {
      message.textContent = `Added ${result.title || "book"} as ${result.bookId}`;
      form.reset();
      await loadLibrary();
      showScreen("home");
    } else {
      message.textContent = `Error: ${result.error || "Unknown error"}`;
    }
  } catch (err) {
    message.textContent = "Could not add book: " + err.message;
  } finally {
    submitButton.disabled = false;
  }
}

  function showBookDetail(book) {
  bookDetail.innerHTML = `
    ${book["Cover URL"] ? `<img src="${book["Cover URL"]}" alt="" style="width:140px;border-radius:10px;display:block;margin:0 auto 18px;">` : ""}

    <h2>${book.Title || "Untitled"}</h2>
    <p><strong>${book.Authors || ""}</strong></p>

    <p>${book.Rating ? "⭐ " + book.Rating : ""}${book.Favorite ? " • Favorite" : ""}</p>

    <p><strong>Status:</strong> ${book.Status || ""}</p>
    <p><strong>Location:</strong> ${book["Shelf / Location"] || ""}</p>
    <p><strong>Genre:</strong> ${book.Genre || ""}</p>

    <p><strong>ISBN-13:</strong> ${book["ISBN-13"] || ""}</p>
    <p><strong>Publisher:</strong> ${book.Publisher || ""}</p>
    <p><strong>Published:</strong> ${book["Published Date"] || ""}</p>
    <p><strong>Pages:</strong> ${book["Page Count"] || ""}</p>

    ${book.Notes ? `<p><strong>Notes:</strong><br>${book.Notes}</p>` : ""}
    ${book.Description ? `<p><strong>Description:</strong><br>${book.Description}</p>` : ""}

    ${book["Google Books Link"] ? `<p><a href="${book["Google Books Link"]}" target="_blank" rel="noreferrer">View source</a></p>` : ""}
  `;

  showScreen("detail");
}

homeScanButton.addEventListener("click", async () => {
  form.reset();
  showScreen("add");
  await startScanner();
});

homeAddButton.addEventListener("click", () => {
  form.reset();
  showScreen("add");
});

homeLibraryButton.addEventListener("click", async () => {
  showScreen("library");
  await loadLibrary();
});

homeFavoritesButton.addEventListener("click", async () => {
  showScreen("favorites");
  if (!allBooks.length) await loadLibrary();
  renderFavorites();
});

backFromAdd.addEventListener("click", async () => {
  await stopScanner();
  showScreen("home");
});

backFromDetail.addEventListener("click", () => {
  showScreen(previousScreen);
});

backFromLibrary.addEventListener("click", () => showScreen("home"));
backFromFavorites.addEventListener("click", () => showScreen("home"));
librarySearch.addEventListener("input", filterLibrary);
submitButton.addEventListener("click", submitBook);

loadSettings();
loadLibrary();
showScreen("home");
