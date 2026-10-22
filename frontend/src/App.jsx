import { useEffect, useState } from 'react';
import './App.css';
import AdminDashboard from './components/AdminDashboard.jsx';
import CustomerBooking from './components/CustomerBooking.jsx';

const initialEventForm = {
  title: '',
  description: '',
  status: 'DRAFT',
  bannerUrl: '',
  venueId: '',
};

function App() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [editingVenueId, setEditingVenueId] = useState('');
  const [venueForm, setVenueForm] = useState({ name: '', address: '', totalSeats: 0 });
  const [seatLayoutForm, setSeatLayoutForm] = useState({ rows: 'A,B,C,D,E', columns: 8, vipColumns: 2 });
  const [authMode, setAuthMode] = useState('login');
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [seatMap, setSeatMap] = useState([]);
  const [venueSeatMap, setVenueSeatMap] = useState([]);
  const [eventForm, setEventForm] = useState(initialEventForm);
  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const isAdmin = user?.role === 'admin';

  const apiRequest = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
  };

  const resetEventForm = (nextVenueId = '') => {
    setEventForm({
      ...initialEventForm,
      venueId: nextVenueId || (venues[0]?.venue_id ? String(venues[0].venue_id) : ''),
    });
  };

  const loadVenues = async () => {
    try {
      const data = await apiRequest('/api/v1/venues');
      const nextVenues = data.venues || [];
      setVenues(nextVenues);
      if (!selectedVenue && nextVenues[0]) {
        setSelectedVenue(String(nextVenues[0].venue_id));
      }
      if (!eventForm.venueId && nextVenues[0]) {
        setEventForm((current) => ({ ...current, venueId: String(nextVenues[0].venue_id) }));
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const loadSession = async () => {
    try {
      const data = await apiRequest('/api/v1/auth/session');
      setUser(data.user);
      await Promise.all([loadEvents(), loadVenues()]);
    } catch {
      setUser(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await apiRequest('/api/v1/events');
      setEvents(data.events || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (!selectedVenue && venues.length) {
      setSelectedVenue(String(venues[0].venue_id));
    }
  }, [selectedVenue, venues]);

  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password }
        : {
            fullName: authForm.fullName,
            email: authForm.email,
            phone: authForm.phone,
            password: authForm.password,
          };

      const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setUser(data.user);
      setAuthForm({ fullName: '', email: '', phone: '', password: '' });
      setMessage({ type: 'success', text: data.message || 'Success' });
      await Promise.all([loadEvents(), loadVenues()]);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
      setUser(null);
      setSelectedEvent(null);
      setSelectedVenue('');
      setSelectedSeats([]);
      setSeatMap([]);
      setEvents([]);
      setMessage({ type: 'success', text: 'Logged out successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleVenueChange = (event) => {
    const { name, value } = event.target;
    setVenueForm((current) => ({ ...current, [name]: value }));
  };

  const handleVenueSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        name: venueForm.name,
        address: venueForm.address,
        totalSeats: Number(venueForm.totalSeats) || 0,
      };

      const endpoint = editingVenueId ? `/api/v1/venues/${editingVenueId}` : '/api/v1/venues';
      const method = editingVenueId ? 'PUT' : 'POST';

      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      setMessage({ type: 'success', text: data.message || 'Venue saved successfully' });
      setVenueForm({ name: '', address: '', totalSeats: 0 });
      setEditingVenueId('');
      const nextVenueId = data.venue?.venue_id || editingVenueId;
      if (nextVenueId) {
        setSelectedVenue(String(nextVenueId));
        await loadVenueSeatMap(String(nextVenueId));
      }
      await loadVenues();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleVenueReset = () => {
    setEditingVenueId('');
    setSelectedVenue('');
    setVenueSeatMap([]);
    setVenueForm({ name: '', address: '', totalSeats: 0 });
  };

  const handleVenueEdit = (venue) => {
    setEditingVenueId(String(venue.venue_id));
    setSelectedVenue(String(venue.venue_id));
    setVenueForm({
      name: venue.name,
      address: venue.address,
      totalSeats: venue.total_seats || 0,
    });
    setMessage({ type: 'success', text: `Editing venue: ${venue.name}` });
    setSeatLayoutForm({
      rows: 'A,B,C,D,E',
      columns: 8,
      vipColumns: 2,
    });
  };

  const loadVenueSeatMap = async (venueId) => {
    if (!venueId || !isAdmin) {
      setVenueSeatMap([]);
      return;
    }

    try {
      const data = await apiRequest(`/api/v1/venues/${venueId}/seats`);
      setVenueSeatMap(data.seats || []);
    } catch (error) {
      setVenueSeatMap([]);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleSeatLayoutSubmit = async (event) => {
    event.preventDefault();

    if (!selectedVenue) {
      setMessage({ type: 'error', text: 'Select a venue to generate the seat map.' });
      return;
    }

    try {
      const data = await apiRequest(`/api/v1/venues/${selectedVenue}/seats`, {
        method: 'POST',
        body: JSON.stringify({
          rows: seatLayoutForm.rows.split(',').map((row) => row.trim()).filter(Boolean),
          columns: Number(seatLayoutForm.columns) || 8,
          vipColumns: Number(seatLayoutForm.vipColumns) || 0,
        }),
      });

      setVenueSeatMap(data.seats || []);
      setMessage({ type: 'success', text: `${data.message || 'Seat layout saved successfully'} (${data.totalSeats} seats)` });
      await loadVenues();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    if (!user) {
      setVenueSeatMap([]);
      return;
    }

    if (isAdmin && selectedVenue) {
      loadVenueSeatMap(selectedVenue);
      return;
    }

    setVenueSeatMap([]);
  }, [user, isAdmin, selectedVenue]);

  const handleEventChange = (event) => {
    const { name, value } = event.target;
    if (name === 'reset') {
      resetEventForm();
      return;
    }
    setEventForm((current) => ({ ...current, [name]: value }));
  };

  const handleEventSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        title: eventForm.title,
        description: eventForm.description,
        status: eventForm.status,
        bannerUrl: eventForm.bannerUrl,
        venueId: eventForm.venueId || undefined,
      };

      const endpoint = selectedEvent
        ? `/api/v1/events/${selectedEvent.event_id}`
        : '/api/v1/events';

      const method = selectedEvent ? 'PUT' : 'POST';

      const data = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      setMessage({ type: 'success', text: data.message || 'Saved successfully' });
      resetEventForm();
      setSelectedEvent(null);
      await loadEvents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleEdit = async (eventItem) => {
    setSelectedEvent(eventItem);
    setSelectedSeats([]);
    setEventForm({
      title: eventItem.title,
      description: eventItem.description || '',
      status: eventItem.status || 'DRAFT',
      bannerUrl: eventItem.banner_url || '',
      venueId: eventItem.venue_id ? String(eventItem.venue_id) : '',
    });
    await loadSeatMap(eventItem.event_id);
    setMessage({ type: 'success', text: `Editing event: ${eventItem.title}` });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadSeatMap = async (eventId) => {
    try {
      const data = await apiRequest(`/api/v1/events/${eventId}/seats`);
      setSeatMap(data.seats || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleSeatToggle = (seatCode, isBooked = false) => {
    if (isBooked) {
      return;
    }

    setSelectedSeats((current) => {
      if (current.includes(seatCode)) {
        return current.filter((seat) => seat !== seatCode);
      }

      return [...current, seatCode];
    });
  };

  const handleSeatClear = () => {
    setSelectedSeats([]);
  };

  const handleSeatConfirm = async () => {
    if (!selectedEvent || selectedSeats.length === 0) {
      setMessage({ type: 'error', text: 'Choose at least one seat before confirming.' });
      return;
    }

    if (isAdmin) {
      setMessage({
        type: 'success',
        text: `Seat plan updated for ${selectedEvent.title}: ${selectedSeats.join(', ')}`,
      });
      return;
    }

    try {
      const data = await apiRequest('/api/v1/seats/order', {
        method: 'POST',
        body: JSON.stringify({ eventId: selectedEvent.event_id, seatCodes: selectedSeats }),
      });

      setMessage({
        type: 'success',
        text: `${data.message}: ${data.seats.map((seat) => seat.seatCode).join(', ')}`,
      });
      setSelectedSeats([]);
      await loadSeatMap(selectedEvent.event_id);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleSeatRelease = async (seatCode) => {
    if (!selectedEvent || !seatCode) {
      return;
    }

    try {
      const data = await apiRequest('/api/v1/seats/order', {
        method: 'DELETE',
        body: JSON.stringify({ eventId: selectedEvent.event_id, seatCodes: [seatCode] }),
      });

      setMessage({
        type: 'success',
        text: `${data.message}: ${data.seats.join(', ')}`,
      });
      await loadSeatMap(selectedEvent.event_id);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (eventId) => {
    try {
      const data = await apiRequest(`/api/v1/events/${eventId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: data.message || 'Deleted successfully' });
      await loadEvents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleStatusPatch = async (eventId, newStatus) => {
    try {
      const data = await apiRequest(`/api/v1/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      setMessage({ type: 'success', text: data.message || 'Status updated' });
      await loadEvents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleEventSelection = async (eventItem) => {
    setSelectedEvent(eventItem);
    setSelectedSeats([]);
    await loadSeatMap(eventItem.event_id);
    setMessage({ type: 'success', text: `Seat selection ready for ${eventItem.title}` });
  };

  if (loading) {
    return <div className="page-shell"><div className="loading">Loading...</div></div>;
  }

  if (!user) {
    return (
      <div className="page-shell auth-shell">
        <div className="auth-card">
          <div className="auth-header">
            <h1>{authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h1>
          </div>

          <form onSubmit={handleAuthSubmit} className="form-grid">
            {authMode === 'register' && (
              <>
                <label>
                  Full name
                  <input name="fullName" value={authForm.fullName} onChange={handleAuthChange} placeholder="Ten nguoi dung" required />
                </label>
                <label>
                  Phone
                  <input name="phone" value={authForm.phone} onChange={handleAuthChange} placeholder="+67676767" required />
                </label>
              </>
            )}

            <label>
              Email
              <input name="email" type="email" value={authForm.email} onChange={handleAuthChange} placeholder="user@gmail.com" required />
            </label>

            <label>
              Password
              <input name="password" type="password" value={authForm.password} onChange={handleAuthChange} placeholder="••••••••" required />
            </label>

            {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

            <button type="submit" className="primary-button">
              {authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>

          <button type="button" className="secondary-button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
            {authMode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Authenticated dashboard</p>
          <h1>{isAdmin ? 'Admin Console' : 'Customer Booking'}</h1>
        </div>
        <div className="user-panel">
          <span>{user.fullName}</span>
          <button type="button" className="secondary-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

      {isAdmin ? (
        <AdminDashboard
          events={events}
          selectedEvent={selectedEvent}
          setSelectedEvent={setSelectedEvent}
          eventForm={eventForm}
          onEventChange={handleEventChange}
          onEventSubmit={handleEventSubmit}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusPatch={handleStatusPatch}
          onHandleSeatToggle={handleSeatToggle}
          seatMap={seatMap}
          selectedSeats={selectedSeats}
          message={message}
          isAdmin={isAdmin}
          venues={venues}
          venueForm={venueForm}
          onVenueChange={handleVenueChange}
          onVenueSubmit={handleVenueSubmit}
          onVenueEdit={handleVenueEdit}
          onVenueReset={handleVenueReset}
          selectedVenue={selectedVenue}
          setSelectedVenue={setSelectedVenue}
          editingVenueId={editingVenueId}
          setEditingVenueId={setEditingVenueId}
          seatLayoutForm={seatLayoutForm}
          setSeatLayoutForm={setSeatLayoutForm}
          onSeatLayoutSubmit={handleSeatLayoutSubmit}
          venueSeatMap={venueSeatMap}
        />
      ) : (
        <CustomerBooking
          venues={venues}
          selectedVenue={selectedVenue}
          setSelectedVenue={setSelectedVenue}
          events={events}
          selectedEvent={selectedEvent}
          onEventSelection={handleEventSelection}
          onSeatToggle={handleSeatToggle}
          onSeatRelease={handleSeatRelease}
          onSeatClear={handleSeatClear}
          seatMap={seatMap}
          selectedSeats={selectedSeats}
          onSeatConfirm={handleSeatConfirm}
        />
      )}
    </div>
  );
}

export default App;
