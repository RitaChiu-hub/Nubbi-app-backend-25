import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const writeLatency = new Trend('write_latency');
const uploadLatency = new Trend('upload_latency');
const errorRate = new Rate('error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 200 },   // Warm-up
    { duration: '1m',  target: 500 },   // Ramp-up
    { duration: '2m',  target: 1000 },  // 1000 concurrent users (target 10,000 ops/sec)
    { duration: '1m',  target: 1000 },  // Peak load
    { duration: '30s', target: 0 },     // Cool-down
  ],
  thresholds: {
    'write_latency': ['p(95)<500'],     // Relax threshold for stress testing
    'upload_latency': ['p(95)<1000'],
    'error_rate': ['rate<0.1'],         // Allow up to 10% error rate (finding breaking point)
  },
};

// ⚠️ Please replace with a real token copied from your browser
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjJiMWZiMGRmLWE3NjQtNDQxZC1iZmVlLTcwY2M0OTAwOTE5NiIsImlhdCI6MTc4MTQ3MjgxMSwiZXhwIjoxNzgxNTU5MjExfQ.OF-Amx3WCy-djKa2zJwVre-EE4FBUJdju2GAPKODItg';
const API_URL = 'http://localhost:8080';
const GROUP_ID = '262'; // Cloud Test Group

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
  };

  // 80% Write operations: simulate posting (triggers Redis count + async AI)
  if (Math.random() < 0.8) {
    const start = Date.now();
    const payload = JSON.stringify({
      title: `Load Test Post ${__VU}-${__ITER}`,
      body_text: 'This is a test post to measure system stability and async processing efficiency.',
      currentGroup: GROUP_ID
    });

    const res = http.post(`${API_URL}/groups/${GROUP_ID}/createpost`, payload, params);

    writeLatency.add(Date.now() - start);
    errorRate.add(res.status !== 200);

    check(res, {
      'post status is 200': (r) => r.status === 200,
      'async trigger success': (r) => r.json().status === 'Post successfully created',
    });
    
    // Each user sends ~10 posts per second -> 1000 VUs = 10,000 ops/sec
    sleep(0.1);

  // 20% Upload operations: simulate getting S3 presigned URL
  } else {
    const start = Date.now();
    const payload = JSON.stringify({
      fileName: `stress-test-${__VU}.jpg`,
      fileType: 'image/jpeg'
    });

    const res = http.post(`${API_URL}/file/s3-presigned-url`, payload, params);

    uploadLatency.add(Date.now() - start);
    errorRate.add(res.status !== 200);

    check(res, {
      'upload status is 200': (r) => r.status === 200,
      'got presigned url': (r) => r.json().uploadUrl !== undefined,
    });

    sleep(1);
  }
}
