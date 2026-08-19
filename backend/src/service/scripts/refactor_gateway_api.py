import os
import re

api_path = "d:/amazon-last-mile/backend/src/routes/api.js"
with open(api_path, "r") as f:
    content = f.read()

events_proxy = """
// GET /api/events
router.get('/events', async (req, res) => {
  try {
    const route_id = req.query.route_id || '';
    const { data } = await proxy.getEvents(route_id);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Events fetch failed', detail: err.message });
  }
});

// POST /api/events/:eventId/approve
router.post('/events/:eventId/approve', async (req, res) => {
  try {
    const { data } = await proxy.approveEvent(req.params.eventId, req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Approve failed', detail: err.message });
  }
});

// POST /api/events/:eventId/reject
router.post('/events/:eventId/reject', async (req, res) => {
  try {
    const { data } = await proxy.rejectEvent(req.params.eventId, req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Reject failed', detail: err.message });
  }
});
"""

content = content.replace("// GET /api/simulations", events_proxy + "\n// GET /api/simulations")

with open(api_path, "w") as f:
    f.write(content)
print("Updated routes/api.js")
