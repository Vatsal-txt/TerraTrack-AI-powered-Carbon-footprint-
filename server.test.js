// server.test.js - API & Integration Tests for TerraTrack
const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Configure test database path BEFORE requiring server
const testDbPath = path.join(__dirname, 'db.test.json');
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = 'test_token_secret_98765';

// Mock the Google Generative AI SDK
jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => {
            return {
                getGenerativeModel: jest.fn().mockImplementation(() => {
                    return {
                        generateContent: jest.fn().mockResolvedValue({
                            response: {
                                text: () => '<p>Mocked Gemini Diagnosis Analysis</p>'
                            }
                        }),
                        startChat: jest.fn().mockImplementation(() => {
                            return {
                                sendMessage: jest.fn().mockResolvedValue({
                                    response: {
                                        text: () => 'Mocked Gemini Chat Reply'
                                    }
                                })
                            };
                        })
                    };
                })
            };
        })
    };
});

const app = require('./server');

describe('TerraTrack Backend API Tests', () => {
    let authToken = '';
    const testUser = {
        name: 'Test Engineer',
        email: `tester_${Date.now()}@example.com`,
        password: 'securePassword123'
    };

    // Backup and Mock fetch for OpenRouter calls
    const originalFetch = global.fetch;

    beforeAll(() => {
        // Ensure database starts fresh
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        global.fetch = jest.fn().mockImplementation((url, options) => {
            if (url && url.includes('openrouter.ai')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        choices: [
                            {
                                message: {
                                    content: '<p>Mocked OpenRouter Response</p>'
                                }
                            }
                        ]
                    })
                });
            }
            if (typeof originalFetch === 'function') {
                return originalFetch(url, options);
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        });
    });

    afterAll(() => {
        // Restore fetch
        global.fetch = originalFetch;

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

    describe('AI Integration Endpoints (Mocked)', () => {
        const mockPayload = {
            calculations: {
                total: 4.5,
                transport: 1.2,
                food: 1.5,
                energy: 1.0,
                waste: 0.5,
                routine: 0.3
            },
            responses: {
                name: 'Updated Tester',
                age: 25,
                city: 'Test City',
                citytype: 'urban',
                household: 2
            }
        };

        it('should fail AI diagnosis if API Key is missing', async () => {
            const res = await request(app)
                .post('/api/ai/insights')
                .set('Authorization', `Bearer ${authToken}`)
                .send(mockPayload);
            
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('AI Key Missing');
        });

        it('should return AI diagnosis when calling insights via Gemini SDK', async () => {
            const res = await request(app)
                .post('/api/ai/insights')
                .set('Authorization', `Bearer ${authToken}`)
                .set('x-gemini-key', 'AIzaSyTestGeminiKey12345')
                .send(mockPayload);
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('insights');
            expect(res.body.insights).toContain('Mocked Gemini');
        });

        it('should return AI diagnosis when calling insights via OpenRouter', async () => {
            const res = await request(app)
                .post('/api/ai/insights')
                .set('Authorization', `Bearer ${authToken}`)
                .set('x-gemini-key', 'sk-or-v1-testOpenRouterKey')
                .send(mockPayload);
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('insights');
            expect(res.body.insights).toContain('Mocked OpenRouter');
        });

        it('should return AI chat response via Gemini SDK flow', async () => {
            const res = await request(app)
                .post('/api/ai/chat')
                .set('Authorization', `Bearer ${authToken}`)
                .set('x-gemini-key', 'AIzaSyTestGeminiKey12345')
                .send({
                    message: 'How to save energy?',
                    history: []
                });
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('reply');
            expect(res.body.reply).toBe('Mocked Gemini Chat Reply');
        });

        it('should return AI chat response via OpenRouter flow', async () => {
            const res = await request(app)
                .post('/api/ai/chat')
                .set('Authorization', `Bearer ${authToken}`)
                .set('x-gemini-key', 'sk-or-v1-testOpenRouterKey')
                .send({
                    message: 'How to save energy?',
                    history: []
                });
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('reply');
            expect(res.body.reply).toBe('Mocked OpenRouter Response');
        });
    });
});
