/**
 * Storage Quota Manager
 * Handles storage quota management and data compression
 */

class StorageQuotaManager {
    // Chrome sync storage limits
    static SYNC_QUOTA = {
        BYTES_PER_ITEM: 8192,    // 8KB per item
        BYTES_TOTAL: 102400,     // 100KB total
        MAX_ITEMS: 512,          // Maximum number of items
        WRITES_PER_HOUR: 1800,   // Maximum write operations per hour
        WRITES_PER_MINUTE: 120   // Maximum write operations per minute
    };

    /**
     * Check if data exceeds sync storage quota
     * @param {Object} data - Data to check
     * @returns {boolean} Whether data exceeds quota
     */
    static exceedsQuota(data) {
        const serialized = JSON.stringify(data);
        return serialized.length > this.SYNC_QUOTA.BYTES_PER_ITEM;
    }

    /**
     * Split data into chunks that fit within sync storage quota
     * @param {Object} data - Data to split
     * @param {string} key - Storage key
     * @returns {Object} Chunked data
     */
    static chunkData(data, key) {
        const serialized = JSON.stringify(data);
        const chunkSize = this.SYNC_QUOTA.BYTES_PER_ITEM - 100; // Leave room for chunk metadata
        const chunks = {};
        
        // If data fits in a single chunk, return as is
        if (serialized.length <= chunkSize) {
            return { [key]: data };
        }

        // Split into chunks
        let position = 0;
        let chunkIndex = 0;
        while (position < serialized.length) {
            const chunk = serialized.substr(position, chunkSize);
            chunks[`${key}_chunk_${chunkIndex}`] = {
                data: chunk,
                total: Math.ceil(serialized.length / chunkSize),
                index: chunkIndex,
                key: key
            };
            position += chunkSize;
            chunkIndex++;
        }

        return chunks;
    }

    /**
     * Reassemble chunked data
     * @param {Object} chunks - Chunked data
     * @param {string} key - Storage key
     * @returns {*} Reassembled data
     */
    static reassembleChunks(chunks, key) {
        // Find all chunks for this key
        const keyChunks = Object.entries(chunks)
            .filter(([chunkKey]) => chunkKey.startsWith(`${key}_chunk_`))
            .map(([, chunk]) => chunk)
            .sort((a, b) => a.index - b.index);

        // If no chunks found or incomplete set, return null
        if (keyChunks.length === 0 || keyChunks.length !== keyChunks[0].total) {
            return null;
        }

        // Reassemble chunks
        const serialized = keyChunks.map(chunk => chunk.data).join('');
        try {
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Error reassembling chunks:', error);
            return null;
        }
    }

    /**
     * Compress data using a simple RLE algorithm
     * @param {string} data - Data to compress
     * @returns {string} Compressed data
     */
    static compress(data) {
        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }

        let compressed = '';
        let count = 1;
        let current = data[0];

        for (let i = 1; i <= data.length; i++) {
            if (data[i] === current && count < 255) {
                count++;
            } else {
                compressed += `${count}${current}`;
                current = data[i];
                count = 1;
            }
        }

        return compressed;
    }

    /**
     * Decompress RLE-compressed data
     * @param {string} compressed - Compressed data
     * @returns {string} Decompressed data
     */
    static decompress(compressed) {
        let decompressed = '';
        let i = 0;

        while (i < compressed.length) {
            const count = parseInt(compressed[i++], 10);
            const char = compressed[i++];
            decompressed += char.repeat(count);
        }

        try {
            return JSON.parse(decompressed);
        } catch {
            return decompressed;
        }
    }
}

export { StorageQuotaManager };