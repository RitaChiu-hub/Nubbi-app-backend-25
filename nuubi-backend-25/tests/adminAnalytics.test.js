const request = require("supertest");
const { app, server } = require("../index");
const { jwtSign } = require("../controllers/jwt/jwtAuth");
const pool = require("../db");

/**
 * Admin Analytics Integration Tests
 * 
 * Verifies the core functionality of the deep participation analytics endpoint.
 */

describe("Admin Analytics API", () => {
  let adminToken;
  let testGroupId;
  const adminId = "admin-1";

  beforeAll(async () => {
    // 1. Generate a valid JWT for the admin
    adminToken = await jwtSign({ id: adminId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // 2. Find the test group created by the seeding script
    const groupRes = await pool.query("SELECT id FROM groups WHERE name = $1 LIMIT 1", ["Data Science 101"]);
    if (groupRes.rows.length > 0) {
      testGroupId = groupRes.rows[0].id;
    } else {
      // Fallback: create a temporary test group if not found
      const newGroup = await pool.query(
        "INSERT INTO groups (name, description, is_public) VALUES ($1, $2, $3) RETURNING id",
        ["Test Analytics Group", "Created for automated testing", true]
      );
      testGroupId = newGroup.rows[0].id;
      
      // Add admin to group
      await pool.query(
        "INSERT INTO participants (user_id, group_id, is_admin) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [adminId, testGroupId, true]
      );
    }
  });

  afterAll(async () => {
    // Close DB connection and server to prevent hanging
    await pool.end();
    server.close();
  });

  describe("POST /analytics/admin/groups/:groupId/participation/deep", () => {
    it("should return deep participation data for a valid admin", async () => {
      const response = await request(app)
        .post(`/analytics/admin/groups/${testGroupId}/participation/deep`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sortBy: "engagement_score",
          sortOrder: "desc",
          limit: 10,
          offset: 0
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("analytics");
      expect(response.body).toHaveProperty("class_statistics");
      expect(Array.isArray(response.body.analytics)).toBe(true);
      
      // Verify structure of a student record
      if (response.body.analytics.length > 0) {
        const student = response.body.analytics[0];
        expect(student).toHaveProperty("user_id");
        expect(student).toHaveProperty("engagement_score");
        expect(student).toHaveProperty("participation");
        expect(student).toHaveProperty("rankings");
      }
    });

    it("should return 401 if token is missing", async () => {
      const response = await request(app)
        .post(`/analytics/admin/groups/${testGroupId}/participation/deep`)
        .send({});

      expect(response.status).toBe(401);
    });

    it("should return 403 if user is not an admin of the group", async () => {
      // Create a token for a non-admin student
      const studentToken = await jwtSign({ id: "student-1" }, process.env.JWT_SECRET, { expiresIn: "1h" });
      
      const response = await request(app)
        .post(`/analytics/admin/groups/${testGroupId}/participation/deep`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({});

      // requireGroupAdmin should reject non-admins
      expect(response.status).toBe(403);
    });

    it("should correctly sort data by engagement_score", async () => {
      const response = await request(app)
        .post(`/analytics/admin/groups/${testGroupId}/participation/deep`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sortBy: "engagement_score",
          sortOrder: "desc"
        });

      const analytics = response.body.analytics;
      if (analytics.length >= 2) {
        expect(analytics[0].engagement_score).toBeGreaterThanOrEqual(analytics[1].engagement_score);
      }
    });
  });

  describe("GET /analytics/admin/health", () => {
    it("should return ok without auth", async () => {
      const response = await request(app).get("/analytics/admin/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, service: "admin-analytics" });
    });
  });
});
