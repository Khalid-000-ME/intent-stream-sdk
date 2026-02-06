// Yellow Network Client - Server-Side Authentication
export class YellowServerClient {
    private sessionId: string;
    private connected: boolean = false;
    private authenticated: boolean = false;

    constructor() {
        this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async connect(): Promise<void> {
        console.log('🔌 Connecting to Yellow Network via API...');

        const response = await fetch('/api/yellow-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'connect',
                sessionId: this.sessionId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to connect');
        }

        this.connected = true;
        console.log('✅ Connected to Yellow Network!');
    }

    async authenticate(): Promise<any> {
        if (!this.connected) {
            throw new Error('Not connected. Call connect() first.');
        }

        console.log('🔐 Starting authentication (server-side)...');

        const response = await fetch('/api/yellow-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'auth_full',
                sessionId: this.sessionId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Authentication failed');
        }

        this.authenticated = true;
        console.log('✅ Authenticated successfully!');
        console.log('   Address:', data.address);
        console.log('   Session key:', data.sessionKey);

        return data;
    }

    async getBalances(): Promise<any> {
        if (!this.authenticated) {
            throw new Error('Not authenticated');
        }

        console.log('💰 Fetching balances...');

        const response = await fetch('/api/yellow-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_balances',
                sessionId: this.sessionId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to get balances');
        }

        console.log('✅ Balances:', data.balances);
        return data.balances;
    }

    async disconnect(): Promise<void> {
        await fetch('/api/yellow-full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'disconnect',
                sessionId: this.sessionId
            })
        });

        this.connected = false;
        this.authenticated = false;
        console.log('👋 Disconnected');
    }

    isConnected(): boolean {
        return this.connected;
    }

    isAuthenticated(): boolean {
        return this.authenticated;
    }
}
