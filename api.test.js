jest.setTimeout(30000);

const request = require("supertest");
const api = request("http://mood-journal-api:3000");

const fmt = (d) => d.toISOString().split("T")[0];

async function createEntry(text) {
  const res = await api.post("/api/entries").send({ text });
  return res.body.id;
}

async function listEntries(query = "") {
  return api.get(`/api/entries${query}`);
}

async function getEntry(id) {
  return api.get(`/api/entries/${id}`);
}

async function updateEntry(id, text) {
  return api.put(`/api/entries/${id}`).send({ text });
}

async function deleteEntry(id) {
  return api.delete(`/api/entries/${id}`);
}

async function getMoodSummary(query = "") {
  return api.get(`/api/mood/summary${query}`);
}

const validTexts = [
  "I am very happy today!",
  "Feeling sad and lonely",
  "So angry about everything",
  "This is disgusting",
  "Today was amazing and joyful",
];

const invalidTexts = ["", "   ", "  \t  \n  ", null, undefined];

describe("Task 1: Health Check Endpoint", () => {
  it("should return 200 OK with correct JSON structure when checking health status", async () => {
    const { status, body } = await api.get("/api/health");

    expect(status, "Health endpoint should return 200 OK status").toBe(200);
    expect(
      body,
      "Health endpoint should return correct JSON structure"
    ).toEqual({ status: "OK" });
    expect(typeof body.status, "Health status should be a string").toBe(
      "string"
    );
  });
});

describe("Task 2: Journal Entry Model and POST Route", () => {
  it("should reject POST requests with missing text field", async () => {
    const { status, body } = await api.post("/api/entries").send({});

    expect(
      status,
      "POST /api/entries should return 400 when text field is missing"
    ).toBe(400);
    expect(
      body,
      "Should return specific error message for missing text"
    ).toEqual({ error: "Text must not be empty" });
  });

  it("should reject POST requests with empty or whitespace-only text", async () => {
    for (const invalidText of invalidTexts.filter(
      (t) => t !== null && t !== undefined
    )) {
      const { status, body } = await api
        .post("/api/entries")
        .send({ text: invalidText });

      expect(
        status,
        `POST /api/entries should return 400 for invalid text: "${invalidText}"`
      ).toBe(400);
      expect(
        body,
        `Should return error for whitespace text: "${invalidText}"`
      ).toEqual({ error: "Text must not be empty" });
    }
  });

  it("should reject POST requests with null or undefined text", async () => {
    for (const invalidText of [null, undefined]) {
      const { status, body } = await api
        .post("/api/entries")
        .send({ text: invalidText });

      expect(
        status,
        `POST /api/entries should return 400 for ${invalidText} text`
      ).toBe(400);
      expect(body, `Should return error for ${invalidText} text`).toEqual({
        error: "Text must not be empty",
      });
    }
  });

  it("should successfully create entry and return 201 with valid UUID", async () => {
    const entryText = "My first journal entry";
    const { status, body } = await api
      .post("/api/entries")
      .send({ text: entryText });

    expect(
      status,
      "POST /api/entries should return 201 Created for valid entry"
    ).toBe(201);
    expect(body).toHaveProperty("id");
    expect(typeof body.id, "Entry ID should be a string").toBe("string");
    expect(body.id, "Entry ID should be a valid UUID format").toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("should create multiple entries with unique IDs", async () => {
    const ids = [];

    for (const text of validTexts.slice(0, 3)) {
      const { status, body } = await api.post("/api/entries").send({ text });
      expect(status, `Should create entry for text: "${text}"`).toBe(201);
      ids.push(body.id);
    }

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size, "All created entries should have unique IDs").toBe(
      ids.length
    );
  });
});

describe("Task 3: CRUD Operations", () => {
  let testEntryId;
  const testText = "Test entry for CRUD operations";

  beforeAll(async () => {
    testEntryId = await createEntry(testText);
  });

  it("should return 200 OK with array of entries when no query parameters provided", async () => {
    const { status, body } = await listEntries();

    expect(status, "GET /api/entries should return 200 OK").toBe(200);
    expect(Array.isArray(body), "Response should be an array").toBe(true);
    expect(body.length, "Should have at least one entry").toBeGreaterThan(0);
  });

  it("should return entries with correct structure including all required fields", async () => {
    const { status, body } = await listEntries();

    expect(status, "GET /api/entries should return 200 OK").toBe(200);

    const entry = body.find((e) => e.id === testEntryId);
    expect(entry).toBeDefined();
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("text");
    expect(entry).toHaveProperty("createdAt");
    expect(entry).toHaveProperty("mood");

    expect(typeof entry.id, "Entry ID should be string").toBe("string");
    expect(typeof entry.text, "Entry text should be string").toBe("string");
    expect(typeof entry.createdAt, "Entry createdAt should be string").toBe(
      "string"
    );
    expect(typeof entry.mood, "Entry mood should be string").toBe("string");

    expect(entry.text, "Entry text should match what was created").toBe(
      testText
    );
  });

  it("should return 200 OK with correct entry for valid UUID", async () => {
    const { status, body } = await getEntry(testEntryId);

    expect(
      status,
      "GET /api/entries/:id should return 200 for valid UUID"
    ).toBe(200);
    expect(body, "Should return entry with matching ID").toHaveProperty(
      "id",
      testEntryId
    );
    expect(body.text).toBe(testText);
    expect(body).toHaveProperty("createdAt");
    expect(body).toHaveProperty("mood");
  });

  it("should return 404 for non-existent but valid UUID", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const { status } = await getEntry(nonExistentId);

    expect(
      status,
      "GET /api/entries/:id should return 404 for non-existent entry"
    ).toBe(404);
  });

  it("should return 400 for invalid UUID format", async () => {
    const invalidIds = ["not-a-uuid", "123", "invalid-format"];

    for (const invalidId of invalidIds) {
      const { status } = await getEntry(invalidId);
      expect(
        status,
        `GET /api/entries/:id should return 400 for invalid UUID: "${invalidId}"`
      ).toBe(400);
    }
  });

  it("should return 400 for empty or invalid text during update", async () => {
    for (const invalidText of invalidTexts.filter(
      (t) => t !== null && t !== undefined
    )) {
      const { status, body } = await updateEntry(testEntryId, invalidText);

      expect(
        status,
        `PUT should return 400 for invalid text: "${invalidText}"`
      ).toBe(400);
      expect(body).toHaveProperty("error");
    }
  });

  it("should return 404 for non-existent entry during update", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const { status } = await updateEntry(nonExistentId, "Updated text");

    expect(status, "PUT should return 404 for non-existent entry").toBe(404);
  });

  it("should return 400 for invalid UUID format during update", async () => {
    const invalidIds = ["not-a-uuid", "123", "invalid-format"];

    for (const invalidId of invalidIds) {
      const { status } = await updateEntry(invalidId, "Updated text");
      expect(
        status,
        `PUT should return 400 for invalid UUID: "${invalidId}"`
      ).toBe(400);
    }
  });

  it("should successfully update entry and return 200 with entry ID", async () => {
    const updatedText = "This is the updated text";
    const { status, body } = await updateEntry(testEntryId, updatedText);

    expect(status, "PUT should return 200 for successful update").toBe(200);
    expect(body, "Should return updated entry ID").toEqual({ id: testEntryId });

    const { body: updatedEntry } = await getEntry(testEntryId);
    expect(updatedEntry.text, "Entry text should be updated").toBe(updatedText);
    expect(updatedEntry).toHaveProperty("updatedAt");
    expect(
      typeof updatedEntry.updatedAt,
      "updatedAt should be a string timestamp"
    ).toBe("string");
  });

  it("should return 400 for invalid UUID format during delete", async () => {
    const invalidIds = ["not-a-uuid", "123", "invalid-format"];

    for (const invalidId of invalidIds) {
      const { status } = await deleteEntry(invalidId);
      expect(
        status,
        `DELETE should return 400 for invalid UUID: "${invalidId}"`
      ).toBe(400);
    }
  });

  it("should return 404 for non-existent entry during delete", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const { status } = await deleteEntry(nonExistentId);

    expect(status, "DELETE should return 404 for non-existent entry").toBe(404);
  });

  it("should successfully delete entry and return 204", async () => {
    let entryToDelete;
    entryToDelete = await createEntry("Entry to be deleted");
    const { status } = await deleteEntry(entryToDelete);

    expect(status, "DELETE should return 204 for successful deletion").toBe(
      204
    );

    const { status: getStatus } = await getEntry(entryToDelete);
    expect(getStatus, "Deleted entry should not be found").toBe(404);
  });
});

describe("Task 4: Mood Extraction Service", () => {
  it("should extract and include mood in newly created entries", async () => {
    const entryText = "I am extremely happy and excited today!";
    const entryId = await createEntry(entryText);

    const { status, body } = await getEntry(entryId);

    expect(status, "Should retrieve created entry").toBe(200);
    expect(body).toHaveProperty("mood");
    expect(typeof body.mood, "Mood should be a string").toBe("string");
    expect(body.mood.length, "Mood should not be empty").toBeGreaterThan(0);
  });

  it("should handle mood extraction for entries with different emotional tones", async () => {
    const emotionalTexts = [
      "I am so joyful and happy!",
      "Feeling very sad and depressed today",
      "This makes me extremely angry",
      "I am scared and fearful",
    ];

    for (const text of emotionalTexts) {
      const entryId = await createEntry(text);
      const { body } = await getEntry(entryId);

      expect(body).toHaveProperty("mood");
      expect(
        typeof body.mood,
        `Mood should be string for text: "${text}"`
      ).toBe("string");
    }
  });
});

describe("Task 5: Mood Filtering", () => {
  let testEntries = [];

  beforeAll(async () => {
    const textsWithExpectedMoods = [
      "I am very happy today!",
      "Feeling quite sad",
      "This is making me angry",
      "What a joyful moment",
    ];

    for (const text of textsWithExpectedMoods) {
      const id = await createEntry(text);
      const { body } = await getEntry(id);
      testEntries.push(body);
    }
  });

  afterAll(async () => {
    await Promise.all(testEntries.map((entry) => deleteEntry(entry.id)));
  });

  it("should filter entries by single mood when valid mood parameter provided", async () => {
    const targetMood = testEntries[0].mood;
    const { status, body } = await listEntries(`?moods=${targetMood}`);

    expect(status, "Mood filtering should return 200 OK").toBe(200);
    expect(Array.isArray(body), "Response should be an array").toBe(true);

    body.forEach((entry) => {
      expect(entry.mood, `All entries should have mood "${targetMood}"`).toBe(
        targetMood
      );
    });
  });

  it("should filter entries by multiple moods when comma-separated moods provided", async () => {
    const targetMoods = testEntries.slice(0, 2).map((e) => e.mood);
    const { status, body } = await listEntries(
      `?moods=${targetMoods.join(",")}`
    );

    expect(status, "Multi-mood filtering should return 200 OK").toBe(200);
    expect(Array.isArray(body), "Response should be an array").toBe(true);

    body.forEach((entry) => {
      expect(
        targetMoods,
        `Entry mood should be one of: ${targetMoods.join(", ")}`
      ).toContain(entry.mood);
    });
  });

  it("should return empty array for non-existent mood", async () => {
    const { status, body } = await listEntries("?moods=nonexistentmood");

    expect(status, "Non-existent mood filter should return 200 OK").toBe(200);
    expect(body, "Should return empty array for non-existent mood").toEqual([]);
  });

  it("should handle empty moods parameter gracefully", async () => {
    const { status, body } = await listEntries("?moods=");

    expect(status, "Empty moods parameter should return 200 OK").toBe(200);
    expect(
      Array.isArray(body),
      "Should return array for empty moods parameter"
    ).toBe(true);
  });
});

describe("Task 6: Mood Summary Endpoint", () => {
  let summaryTestEntries = [];

  beforeAll(async () => {
    const testTexts = [
      "Happy day number 1",
      "Happy day number 2",
      "Sad day today",
      "Angry about something",
      "Disgusting situation",
    ];

    for (const text of testTexts) {
      const id = await createEntry(text);
      const { body } = await getEntry(id);
      summaryTestEntries.push(body);
    }
  });

  afterAll(async () => {
    await Promise.all(summaryTestEntries.map((entry) => deleteEntry(entry.id)));
  });

  it("should return 200 OK with mood counts object", async () => {
    const { status, body } = await getMoodSummary();

    expect(status, "GET /api/mood/summary should return 200 OK").toBe(200);
    expect(typeof body, "Response should be an object").toBe("object");
    expect(body).not.toBeNull();
    expect(Array.isArray(body), "Response should not be an array").toBe(false);
  });

  it("should return counts for each mood present in database", async () => {
    const { status, body } = await getMoodSummary();

    expect(status, "Mood summary should return 200 OK").toBe(200);

    Object.keys(body).forEach((mood) => {
      expect(
        typeof body[mood],
        `Count for mood "${mood}" should be a number`
      ).toBe("number");
      expect(
        body[mood],
        `Count for mood "${mood}" should be non-negative`
      ).toBeGreaterThanOrEqual(0);
    });
  });

  it("should include moods from our test entries with correct counts", async () => {
    const { status, body } = await getMoodSummary();

    expect(status, "Mood summary should return 200 OK").toBe(200);

    const testMoods = [...new Set(summaryTestEntries.map((e) => e.mood))];

    testMoods.forEach((mood) => {
      expect(body).toHaveProperty(mood);
      expect(
        body[mood],
        `Mood "${mood}" should have at least 1 entry`
      ).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("Task 7: Time Range Filtering", () => {
  let timeFilterEntries = [];
  let testDates = {};

  beforeAll(async () => {
    const now = new Date();
    testDates.today = fmt(now);

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    testDates.yesterday = fmt(yesterday);

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    testDates.tomorrow = fmt(tomorrow);

    const pastDate = new Date("2020-01-01");
    testDates.past = fmt(pastDate);

    const testTexts = [
      "Entry for time filtering test 1",
      "Entry for time filtering test 2",
    ];
    for (const text of testTexts) {
      const id = await createEntry(text);
      const { body } = await getEntry(id);
      timeFilterEntries.push(body);
    }
  });

  afterAll(async () => {
    await Promise.all(timeFilterEntries.map((entry) => deleteEntry(entry.id)));
  });

  it("should filter entries by date range when both startDate and endDate provided", async () => {
    const { status, body } = await listEntries(
      `?startDate=${testDates.yesterday}&endDate=${testDates.tomorrow}`
    );

    expect(status, "Date range filtering should return 200 OK").toBe(200);
    expect(Array.isArray(body), "Response should be an array").toBe(true);

    body.forEach((entry) => {
      const entryDate = new Date(entry.createdAt);
      const startDate = new Date(testDates.yesterday);
      const endDate = new Date(testDates.tomorrow);

      expect(
        entryDate >= startDate && entryDate <= endDate,
        `Entry date ${entry.createdAt} should be between ${testDates.yesterday} and ${testDates.tomorrow}`
      ).toBe(true);
    });
  });

  it("should return empty array for past date range with no entries", async () => {
    const pastStart = "2000-01-01";
    const pastEnd = "2000-01-02";
    const { status, body } = await listEntries(
      `?startDate=${pastStart}&endDate=${pastEnd}`
    );

    expect(status, "Past date range filtering should return 200 OK").toBe(200);
    expect(
      body,
      "Should return empty array for date range with no entries"
    ).toEqual([]);
  });

  it("should handle single date parameter startDate only", async () => {
    const { status, body } = await listEntries(
      `?startDate=${testDates.yesterday}`
    );

    expect(status, "Start date only filtering should return 200 OK").toBe(200);
    expect(Array.isArray(body), "Response should be an array").toBe(true);
  });

  it("should handle single date parameter endDate only", async () => {
    const { status, body } = await listEntries(
      `?endDate=${testDates.tomorrow}`
    );

    expect(status, "End date only filtering should return 200 OK").toBe(200);
    expect(Array.isArray(body), "Response should be an array").toBe(true);
  });

  it("should return 400 for invalid date format with descriptive error", async () => {
    const invalidDates = [
      "invalid-date",
      "2023-13-45",
      "not-a-date",
      "20230101",
    ];

    for (const invalidDate of invalidDates) {
      const { status, body } = await listEntries(`?startDate=${invalidDate}`);

      expect(
        status,
        `Should return 400 for invalid date: "${invalidDate}"`
      ).toBe(400);
      expect(body).toHaveProperty("error");
    }
  });

  it("should filter mood summary by date range", async () => {
    const { status, body } = await getMoodSummary(
      `?startDate=${testDates.yesterday}&endDate=${testDates.tomorrow}`
    );

    expect(status, "Date-filtered mood summary should return 200 OK").toBe(200);
    expect(typeof body, "Response should be an object").toBe("object");

    Object.keys(body).forEach((mood) => {
      expect(
        typeof body[mood],
        `Count for mood "${mood}" should be a number`
      ).toBe("number");
      expect(
        body[mood],
        `Count for mood "${mood}" should be non-negative`
      ).toBeGreaterThanOrEqual(0);
    });
  });

  it("should return empty object for past date range with no entries", async () => {
    const pastStart = "2000-01-01";
    const pastEnd = "2000-01-02";
    const { status, body } = await getMoodSummary(
      `?startDate=${pastStart}&endDate=${pastEnd}`
    );

    expect(status, "Past date range mood summary should return 200 OK").toBe(
      200
    );
    expect(
      body,
      "Should return empty object for date range with no entries"
    ).toEqual({});
  });

  it("should return 400 for invalid date format in mood summary", async () => {
    const invalidDates = ["invalid-date", "2023-13-45", "not-a-date"];

    for (const invalidDate of invalidDates) {
      const { status, body } = await getMoodSummary(
        `?startDate=${invalidDate}`
      );

      expect(
        status,
        `Mood summary should return 400 for invalid date: "${invalidDate}"`
      ).toBe(400);
      expect(body).toHaveProperty("error");
    }
  });

  it("should handle complete CRUD lifecycle with mood extraction and timestamps", async () => {
    const originalText = "This is a wonderful day full of joy!";
    const entryId = await createEntry(originalText);
    expect(typeof entryId, "Should create entry and return ID").toBe("string");

    let { status, body } = await getEntry(entryId);
    expect(status, "Should retrieve created entry").toBe(200);
    expect(body.text, "Entry text should match").toBe(originalText);
    expect(body).toHaveProperty("mood");
    expect(body).toHaveProperty("createdAt");

    const updatedText = "Now I am feeling very sad and depressed";
    ({ status, body } = await updateEntry(entryId, updatedText));
    expect(status, "Should update entry successfully").toBe(200);

    ({ status, body } = await getEntry(entryId));
    expect(status, "Should retrieve updated entry").toBe(200);
    expect(body.text, "Entry text should be updated").toBe(updatedText);
    expect(body).toHaveProperty("updatedAt");

    ({ status } = await deleteEntry(entryId));
    expect(status, "Should delete entry successfully").toBe(204);

    ({ status } = await getEntry(entryId));
    expect(status, "Deleted entry should not be found").toBe(404);
  });

  it("should handle combined mood and date filtering correctly", async () => {
    let combinedTestEntries = [];
    const testData = [
      "Happy entry from today",
      "Sad entry from today",
      "Another happy entry",
    ];

    for (const text of testData) {
      const id = await createEntry(text);
      const { body } = await getEntry(id);
      combinedTestEntries.push(body);
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const targetMood = combinedTestEntries[0].mood;

    const { status, body } = await listEntries(
      `?moods=${targetMood}&startDate=${fmt(yesterday)}&endDate=${fmt(
        tomorrow
      )}`
    );

    expect(status, "Combined filtering should return 200 OK").toBe(200);
    expect(Array.isArray(body), "Response should be an array").toBe(true);

    body.forEach((entry) => {
      expect(entry.mood, `All entries should have mood "${targetMood}"`).toBe(
        targetMood
      );

      const entryDate = new Date(entry.createdAt);
      expect(
        entryDate >= yesterday && entryDate <= tomorrow,
        "All entries should be within date range"
      ).toBe(true);
    });

    await Promise.all(
      combinedTestEntries.map((entry) => deleteEntry(entry.id))
    );
  });

  it("should return 400 for multiple invalid parameters", async () => {
    const { status, body } = await listEntries(
      "?moods=&startDate=invalid&endDate=invalid"
    );

    expect(status, "Should return 400 for invalid date parameters").toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("should handle large text entries within reasonable limits", async () => {
    const largeText = "A".repeat(1000);
    const entryId = await createEntry(largeText);

    const { status, body } = await getEntry(entryId);
    expect(status, "Should handle large text entries").toBe(200);
    expect(body.text, "Large text should be preserved").toBe(largeText);
    expect(body).toHaveProperty("mood");
  });
});
