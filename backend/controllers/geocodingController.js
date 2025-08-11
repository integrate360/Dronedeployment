const axios = require('axios');

// @desc    Geocode an address string using the free Nominatim service
// @route   GET /api/geocode?search=...
// @access  Private
exports.geocodeAddress = async (req, res) => {
  const { search } = req.query;

  if (!search) {
    return res.status(400).json({ msg: 'Search query is required' });
  }

  // --- NEW LOGIC USING NOMINATIM ---
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json`;

  try {
    // Nominatim's usage policy requires a custom User-Agent header.
    // Replace 'YourAppName' and 'your-email@example.com' with your actual info.
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'YourAppName/1.0 (your-email@example.com)'
      }
    });

    if (!response.data || response.data.length === 0) {
      return res.json([]); // Return an empty array if no results found
    }

    // Map the Nominatim results to the exact same format our frontend expects.
    // This is why the frontend doesn't need to change!
    const results = response.data.map(item => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      label: item.display_name,
    }));

    res.status(200).json(results);

  } catch (error) {
    console.error('Error in geocodeAddress controller:', error.message);
    res.status(500).json({ msg: 'Server error during geocoding' });
  }
};