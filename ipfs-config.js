/**
 * IPFS Configuration for CzarUI Media
 * 
 * Replace the placeholders below with the actual IPFS Content Identifiers (CIDs)
 * for your uploaded media files.
 */

export const IPFS_CONFIG = {
    // Public IPFS Gateway (e.g., https://ipfs.io/ipfs/, https://gateway.pinata.cloud/ipfs/)
    GATEWAY: 'https://ipfs.io/ipfs/',

    // Media CIDs
    MEDIA: {
        // defined for: feb7_2006_N_trafx_Show.mp3
        AUDIO_SHOW: 'QmXrCgHdswjB287EMansUWBMFwukDc3rshmKmwr8crzKpj',

        // defined for: paperchasers2.mp4
        VIDEO_PAPERCHASERS: 'Qmd4WG6pjUuPXV3xByEaVLjGzcGkWf529ux5ED6ySXxESz',

        // defined for: qrillienlogo.png
        LOGO: 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn'
    }
};

/**
 * Helper to get full IPFS URL
 * @param {string} key - Key from MEDIA object
 * @returns {string|null} - Full URL or null if CID is not configured
 */
export const getIpfsUrl = (key) => {
    const cid = IPFS_CONFIG.MEDIA[key];
    if (!cid || cid.includes('INSERT_')) {
        console.warn(`IPFS CID not configured for ${key}`);
        return null; // Return null to fall back to local or empty
    }
    return `${IPFS_CONFIG.GATEWAY}${cid}`;
};
