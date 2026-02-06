import { createPublicClient, http, parseAbi, keccak256, stringToHex } from 'viem';
import { sepolia } from 'viem/chains';

const STORK_ADDR = "0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62";
const ID_ETH_SEARCH = "0x1f0e8f0003c737c05df1ac32c691f163b782c5f10643a6d7f35b71c26b281f62";

const ABI = parseAbi([
    "function getTemporalNumericValueUnsafeV1(bytes32 id) public view returns ((uint64 timestampNs, int192 quantizedValue) value)"
]);

async function main() {
    const client = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });

    const check = async (label: string, id: string) => {
        try {
            console.log(`Checking ${label}: ${id}...`);
            const data = await client.readContract({
                address: STORK_ADDR,
                abi: ABI,
                functionName: 'getTemporalNumericValueUnsafeV1',
                args: [id as `0x${string}`]
            }) as any;

            console.log(`✅ ${label}: Found!`);
            console.log(data);

            const ts = Number(data.timestampNs) / 1e9;
            const now = Date.now() / 1000;
            console.log(`   Time: ${new Date(ts * 1000).toISOString()} (${(now - ts).toFixed(1)}s ago)`);

        } catch (e: any) {
            // console.log(e);
            console.log(`❌ ${label}: Error/Not found`);
        }
    };

    try {
        const v = await client.readContract({
            address: STORK_ADDR,
            abi: parseAbi(["function version() public view returns (string)"]),
            functionName: 'version'
        });
        console.log("✅ Contract Version:", v);
    } catch (e) {
        console.log("❌ Contract fetch failed (Wrong Address?)");
    }

    await check("Search ETH ID", ID_ETH_SEARCH);
    await check("Keccak(ETHUSD)", keccak256(stringToHex("ETHUSD")));
}
main();
