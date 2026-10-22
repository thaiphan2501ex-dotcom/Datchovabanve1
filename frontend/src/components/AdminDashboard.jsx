import SeatMap from './SeatMap.jsx';

function AdminDashboard({
  events,
  selectedEvent,
  setSelectedEvent,
  eventForm,
  onEventChange,
  onEventSubmit,
  onEdit,
  onDelete,
  onStatusPatch,
  onHandleSeatToggle,
  seatMap,
  selectedSeats,
  isAdmin,
  venues,
  venueForm,
  onVenueChange,
  onVenueSubmit,
  onVenueEdit,
  onVenueReset,
  selectedVenue,
  setSelectedVenue,
  editingVenueId,
  setEditingVenueId,
  seatLayoutForm,
  setSeatLayoutForm,
  onSeatLayoutSubmit,
  venueSeatMap,
}) {
  return (
    <div className="dashboard-grid admin-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>{editingVenueId ? 'Edit venue' : 'Create venue'}</h2>
        </div>

        <form onSubmit={onVenueSubmit} className="form-grid">
          <label>
            Venue name
            <input name="name" value={venueForm.name} onChange={onVenueChange} placeholder="Main Hall" required />
          </label>

          <label>
            Address
            <textarea name="address" value={venueForm.address} onChange={onVenueChange} placeholder="123 Market Street" rows="3" required />
          </label>

          <label>
            Total seats
            <input name="totalSeats" type="number" min="0" value={venueForm.totalSeats} onChange={onVenueChange} placeholder="200" />
          </label>

          <div className="button-row">
            <button type="submit" className="primary-button">
              {editingVenueId ? 'Update venue' : 'Create venue'}
            </button>
            {editingVenueId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onVenueReset}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        <div className="venue-list" style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Venue list</h3>
          {venues.length === 0 ? (
            <p className="empty-state">No venues yet.</p>
          ) : (
            <div className="event-list">
              {venues.map((venue) => (
                <div key={venue.venue_id} className="event-card" style={{ padding: '12px 14px' }}>
                  <div className="event-meta">
                    <strong>{venue.name}</strong>
                    <span>{venue.total_seats || 0} seats</span>
                  </div>
                  <p style={{ margin: '8px 0 12px' }}>{venue.address}</p>
                  <div className="event-actions">
                    <button type="button" className="secondary-button" onClick={() => onVenueEdit(venue)}>Edit</button>
                    <button
                      type="button"
                      className="primary-button small"
                      onClick={() => setSelectedVenue(String(venue.venue_id))}
                    >
                      Select for seat plan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Physical seat layout</h2>
        </div>

        <form onSubmit={onSeatLayoutSubmit} className="form-grid">
          <label>
            Venue selector
            <select value={selectedVenue} onChange={(event) => setSelectedVenue(event.target.value)}>
              <option value="">Select venue</option>
              {(venues || []).map((venue) => (
                <option key={venue.venue_id} value={venue.venue_id}>{venue.name}</option>
              ))}
            </select>
          </label>

          <label>
            Rows
            <input
              value={seatLayoutForm.rows}
              onChange={(event) => setSeatLayoutForm((current) => ({ ...current, rows: event.target.value }))}
              placeholder="A,B,C,D,E"
            />
          </label>

          <label>
            Seats per row
            <input
              type="number"
              min="1"
              value={seatLayoutForm.columns}
              onChange={(event) => setSeatLayoutForm((current) => ({ ...current, columns: event.target.value }))}
            />
          </label>

          <label>
            VIP seats at the right side
            <input
              type="number"
              min="0"
              value={seatLayoutForm.vipColumns}
              onChange={(event) => setSeatLayoutForm((current) => ({ ...current, vipColumns: event.target.value }))}
            />
          </label>

          <div className="button-row">
            <button type="submit" className="primary-button" disabled={!selectedVenue}>
              Generate seat map
            </button>
          </div>
        </form>

        {selectedVenue && venueSeatMap.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div className="panel-header" style={{ marginBottom: '12px' }}>
              <h3>Seat preview</h3>
            </div>
            <SeatMap
              seatMap={venueSeatMap}
              selectedSeats={[]}
              onSeatToggle={() => {}}
              isAdmin={true}
            />
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>{selectedEvent ? 'Edit event' : 'Create new event'}</h2>
        </div>

        <form onSubmit={onEventSubmit} className="form-grid">
          <label>
            Event title
            <input name="title" value={eventForm.title} onChange={onEventChange} placeholder="Spring festival" required />
          </label>

          <label>
            Venue
            <select name="venueId" value={eventForm.venueId} onChange={onEventChange}>
              <option value="">Select venue</option>
              {(venues || []).map((venue) => (
                <option key={venue.venue_id} value={venue.venue_id}>{venue.name}</option>
              ))}
            </select>
          </label>

          <label>
            Banner URL
            <input name="bannerUrl" value={eventForm.bannerUrl} onChange={onEventChange} placeholder="https://example.com/banner.jpg" />
          </label>

          <label>
            Status
            <select name="status" value={eventForm.status} onChange={onEventChange}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          <label>
            Description
            <textarea name="description" value={eventForm.description} onChange={onEventChange} rows="4" placeholder="Describe the event" />
          </label>

          <div className="button-row">
            <button type="submit" className="primary-button">
              {selectedEvent ? 'Update event' : 'Create event'}
            </button>
            {selectedEvent && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedEvent(null);
                  onEventChange({ target: { name: 'reset', value: '' } });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {selectedEvent && (
        <section className="panel">
          <div className="panel-header">
            <h2>Seat plan for {selectedEvent.title}</h2>
          </div>

          <div className="seat-controls">
            <span>Selected seats: {selectedSeats.length ? selectedSeats.join(', ') : 'None yet'}</span>
          </div>

          {seatMap.length === 0 ? <p className="empty-state">No seat map loaded yet.</p> : (
            <SeatMap
              seatMap={seatMap}
              selectedSeats={selectedSeats}
              onSeatToggle={onHandleSeatToggle}
              isAdmin={isAdmin}
            />
          )}
        </section>
      )}

      <section className="panel events-panel admin-events-panel">
        <div className="panel-header">
          <h2>Events</h2>
        </div>

        <div className="event-list">
          {events.length === 0 ? (
            <p className="empty-state">No events yet.</p>
          ) : (
            events.map((eventItem) => (
              <article key={eventItem.event_id} className="event-card">
                <div className="event-banner" style={{ backgroundImage: eventItem.banner_url ? `url(${eventItem.banner_url})` : 'linear-gradient(135deg, #0f172a, #1d4ed8)' }} />
                <div className="event-body">
                  <div className="event-meta">
                    <span className="status-pill">{eventItem.status}</span>
                    <span>{eventItem.venue_name || 'Venue'}</span>
                  </div>
                  <h3>{eventItem.title}</h3>
                  <p>{eventItem.description || 'No description provided.'}</p>
                  <div className="event-actions">
                    <button type="button" className="secondary-button" onClick={() => onEdit(eventItem)}>Edit</button>
                    <button type="button" className="secondary-button" onClick={() => onDelete(eventItem.event_id)}>Delete</button>
                    <button type="button" className="primary-button small" onClick={() => onStatusPatch(eventItem.event_id, eventItem.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}>
                      {eventItem.status === 'PUBLISHED' ? 'Move to draft' : 'Publish'}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
