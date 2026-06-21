// server.test.js - API & Integration Tests for TerraTrack
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Configure test database path BEFORE requiring server
const testDbPath = path.join(__dirname, 'db.test.json');
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = 'test_token_secret_98765';

const app = require('./server');

describe('TerraTrack Backend API Tests', () => {
    let authToken = '';
    const testUser = {
        name: 'Test Engineer',
        email: `tester_${Date.now()}@example.com`,
        password: 'securePassword123'
    };

    beforeAll(() => {
        // Ensure database starts fresh
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    afterAll(() => {
        // Clean up test database file
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        const tmpDbPath = `${testDbPath}.tmp`;
        if (fs.existsSync(tmpDbPath)) {
            fs.unlinkSync(tmpDbPath);
        }
    });

    describe('Static Route & Fallback tests', () => {
        it('should resolve request to index.html', async () => {
            const res = await request(app).get('/');
            expect(res.status).toBe(200);
            expect(res.text).toContain('<!DOCTYPE html>');
        });
    });

    describe('Authentication Endpoints', () => {
        it('should sign up a new user successfully', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send(testUser);
            
            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body.name).toBe(testUser.name);
        });

        it('should fail signing up with duplicate email', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send(testUser);
            
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should login user successfully and return JWT token', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                });
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            authToken = res.body.token;
        });

        it('should reject login with wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrongPassword'
                });
            
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });
    });

    describe('Profile & Carbon Tracking Data Endpoints', () => {
        it('should block profile fetch if token is missing', async () => {
            const res = await request(app).get('/api/profile');
            expect(res.status).toBe(401);
        });

        it('should fetch user profile empty baseline responses', async () => {
            const res = await request(app)
                .get('/api/profile')
                .set('Authorization', `Bearer ${authToken}`);
            
            expect(res.status).toBe(200);
            expect(res.body.name).toBe(testUser.name);
            expect(res.body.responses).toBeNull();
        });

        it('should save user onboarding responses successfully', async () => {
            const mockResponses = {
                name: testUser.name,
                age: 25,
                city: 'Test City',
                citytype: 'urban',
                household: 2,
                transPrimary: 'metro',
                transSecondary: 'walk',
                commuteKm: 20,
                diet: 'vegetarian',
                foodDelivery: 'weekly',
                energyBill: 50,
                energyAC: 'low',
                energyFan: 'medium',
                wasteSegregate: 'good',
                wasteRecycle: 'good',
                wastePlastic: 'low',
                routineWork: 'hybrid'
            };

            const res = await request(app)
                .post('/api/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    responses: mockResponses,
                    name: 'Updated Tester'
                });
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.user.name).toBe('Updated Tester');
            expect(res.body.user.responses.age).toBe(25);
        });

        it('should save completed actions checklist items', async () => {
            const mockActions = ['energy_led', 'waste_segregate'];
            const res = await request(app)
                .post('/api/profile/actions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    completedActions: mockActions
                });
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.completedActions).toContain('energy_led');
        });
    });
});
