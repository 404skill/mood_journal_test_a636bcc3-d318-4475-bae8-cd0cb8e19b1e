jest.setTimeout(30000);

const request = require('supertest');
const api = request('http://mood-journal-api:3000');

const fmt = d => d.toISOString().split('T')[0];

async function createEntry(text) {
  const res = await api.post('/api/entries').send({ text });
  return res.body.id;
}

async function listEntries(query = '') {
  const res = await api.get(`/api/entries${query}`);
  return res;
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

describe('Task 1: /api/health', () => {
  it('200 OK and correct body', async () => {
    const { status, body } = await api.get('/api/health');
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'OK' });
  });
});

describe('Tasks 2–4: CRUD + Mood', () => {
  let entryId;

  it('GET /api/entries initially → empty array', async () => {
    const { status, body } = await listEntries();
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it('POST /api/entries rejects invalid text', async () => {
    for (const payload of [{}, { text: '   ' }]) {
      const { status, body } = await api.post('/api/entries').send(payload);
      expect(status).toBe(400);
      expect(body).toEqual({ error: 'Text must not be empty' });
    }
  });

  it('POST /api/entries creates entry', async () => {
    entryId = await createEntry('I am very happy today!');
    expect(typeof entryId).toBe('string');
  });

  it('GET /api/entries returns that entry', async () => {
    const { status, body } = await listEntries();
    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    const e = body[0];
    expect(e).toMatchObject({
      id: entryId,
      text: 'I am very happy today!'
    });
    expect(typeof e.createdAt).toBe('string');
    expect(typeof e.mood).toBe('string');
  });

  it('FILTER by mood via ?moods=', async () => {
    const { body: { mood } } = await getEntry(entryId);
    const { status, body } = await listEntries(`?moods=${mood}`);
    expect(status).toBe(200);
    expect(body.every(x => x.mood === mood)).toBe(true);

    const { body: empty } = await listEntries('?moods=nonexistent');
    expect(empty).toEqual([]);
  });

  it('FILTER by date via ?startDate=&endDate=', async () => {
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const tomorrow  = new Date(now); tomorrow.setDate(now.getDate() + 1);

    const { status, body } = await listEntries(
      `?startDate=${fmt(yesterday)}&endDate=${fmt(tomorrow)}`
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    const { body: past } = await listEntries('?startDate=2000-01-01&endDate=2000-01-02');
    expect(past).toEqual([]);
  });

  it('GET /api/entries/:id – invalid & not found → 404', async () => {
    for (const id of ['not-a-uuid','00000000-0000-0000-0000-000000000000']) {
      const { status } = await getEntry(id);
      expect(status).toBe(404);
    }
  });

  it('GET /api/entries/:id returns mood', async () => {
    const { status, body } = await getEntry(entryId);
    expect(status).toBe(200);
    expect(body.id).toBe(entryId);
    expect(typeof body.mood).toBe('string');
  });

  it('PUT /api/entries/:id validates & updates', async () => {
    let res = await updateEntry(entryId, '');
    expect(res.status).toBe(400);

    for (const bad of ['not-a-uuid','00000000-0000-0000-0000-000000000000']) {
      res = await updateEntry(bad, 'foo');
      expect(res.status).toBe(404);
    }

    res = await updateEntry(entryId, 'Updated entry text');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: entryId });

    const { body: updated } = await getEntry(entryId);
    expect(updated.text).toBe('Updated entry text');
  });

  it('DELETE /api/entries/:id validates & deletes', async () => {
    for (const bad of ['not-a-uuid','00000000-0000-0000-0000-000000000000']) {
      const { status } = await deleteEntry(bad);
      expect(status).toBe(404);
    }

    const { status } = await deleteEntry(entryId);
    expect(status).toBe(204);

    const check = await getEntry(entryId);
    expect(check.status).toBe(404);
  });
});

describe('Tasks 6–7: /api/mood/summary + time filtering', () => {
  const moods = ['joy','sadness','anger','disgust'];
  let ids = [];

  beforeAll(async () => {
    for (const txt of ['Happy day','Sad day','Angry day','Disgusting day']) {
      ids.push(await createEntry(txt));
    }
  });
  afterAll(async () => {
    await Promise.all(ids.map(deleteEntry));
  });

  it('GET /api/mood/summary returns counts', async () => {
    const { status, body } = await api.get('/api/mood/summary');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
    moods.forEach(m => {
      expect(body[m]).toBeGreaterThanOrEqual(1);
    });
  });

  it('filters summary by date range', async () => {
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
    const tomorrow  = new Date(now); tomorrow.setDate(now.getDate()+1);

    const { status, body } = await api.get(
      `/api/mood/summary?startDate=${fmt(yesterday)}&endDate=${fmt(tomorrow)}`
    );
    expect(status).toBe(200);
    expect(body.joy).toBeDefined();
  });

  it('invalid date format → 400', async () => {
    const { status, body } = await api.get('/api/mood/summary?startDate=bad-date');
    expect(status).toBe(400);
    expect(body.error).toMatch(/Invalid/);
  });
});
