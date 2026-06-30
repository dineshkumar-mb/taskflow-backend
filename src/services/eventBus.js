const EventEmitter = require('events');
const eventBus = new EventEmitter();

// Outbound events list:
// 'PROJECT_CREATED', 'ISSUE_CREATED', 'MEMBER_ADDED', 'PLAN_UPGRADED', 'MEETING_STARTED'

eventBus.on('PROJECT_CREATED', (data) => {
    console.log('[EventBus] PROJECT_CREATED event processed:', data);
    // Future BullMQ delegation will reside here
});

eventBus.on('ISSUE_CREATED', (data) => {
    console.log('[EventBus] ISSUE_CREATED event processed:', data);
});

eventBus.on('MEMBER_ADDED', (data) => {
    console.log('[EventBus] MEMBER_ADDED event processed:', data);
});

eventBus.on('PLAN_UPGRADED', (data) => {
    console.log('[EventBus] PLAN_UPGRADED event processed:', data);
});

eventBus.on('MEETING_STARTED', (data) => {
    console.log('[EventBus] MEETING_STARTED event processed:', data);
});

module.exports = eventBus;
