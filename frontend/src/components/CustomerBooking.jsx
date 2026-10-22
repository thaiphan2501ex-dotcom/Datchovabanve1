import SeatMap from './SeatMap.jsx';

function CustomerBooking({
  venues,
  selectedVenue,
  setSelectedVenue,
  events,
  selectedEvent,
  onEventSelection,
  onSeatToggle,
  onSeatRelease,
  onSeatClear,
  seatMap,
  selectedSeats,
  onSeatConfirm,
}) {
  const visibleEvents = (events || []).filter((eventItem) => {
    if (!selectedVenue) {
      return true;
    }
    return Number(eventItem.venue_id) === Number(selectedVenue);
  });

  return (
    <div className="dashboard-grid customer-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>Pick a venue</h2>
        </div>

        <label>
          Venue
          <select value={selectedVenue} onChange={(event) => setSelectedVenue(event.target.value)}>
            <option value="">All venues</option>
            {(venues || []).map((venue) => (
              <option key={venue.venue_id} value={venue.venue_id}>{venue.name}</option>
            ))}
          </select>
        </label>

        <div className="event-list customer-events">
          {visibleEvents.length === 0 ? (
            <p className="empty-state">No events available for this venue.</p>
          ) : (
            visibleEvents.map((eventItem) => (
              <article key={eventItem.event_id} className="event-card">
                <div className="event-banner" style={{ backgroundImage: eventItem.banner_url ? `url(${eventItem.banner_url})` : 'linear-gradient(135deg, #0f172a, #1d4ed8)' }} />
                <div className="event-body">
                  <div className="event-meta">
                    <span className="status-pill">{eventItem.status}</span>
                    <span>{eventItem.venue_name}</span>
                  </div>
                  <h3>{eventItem.title}</h3>
                  <p>{eventItem.description || 'No description provided.'}</p>
                  <div className="event-actions">
                    <button type="button" className="primary-button small" onClick={() => onEventSelection(eventItem)}>
                      Choose seats
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedEvent && (
        <section className="panel">
          <div className="panel-header">
            <h2>Seat selection for {selectedEvent.title}</h2>
          </div>

          <div className="seat-controls">
            <span>Selected seats: {selectedSeats.length ? selectedSeats.join(', ') : 'None yet'}</span>
            <div className="button-row">
              <button type="button" className="secondary-button small" onClick={onSeatClear} disabled={!selectedSeats.length}>
                Clear selection
              </button>
              <button type="button" className="primary-button small" onClick={onSeatConfirm}>
                Confirm seats
              </button>
            </div>
          </div>

          {selectedSeats.length > 0 && (
            <div className="selected-seat-list" style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {selectedSeats.map((seatCode) => (
                <button
                  key={seatCode}
                  type="button"
                  className="secondary-button small"
                  onClick={() => onSeatToggle(seatCode, false)}
                >
                  Remove {seatCode}
                </button>
              ))}
            </div>
          )}

          {seatMap.length === 0 ? <p className="empty-state">No seat map loaded yet.</p> : (
            <SeatMap
              seatMap={seatMap}
              selectedSeats={selectedSeats}
              onSeatToggle={onSeatToggle}
              onSeatRelease={onSeatRelease}
              isAdmin={false}
            />
          )}
        </section>
      )}
    </div>
  );
}

export default CustomerBooking;
