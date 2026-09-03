import pytest
from app.system.models import User
from app.system.service import handle_clerk_user_upsert

@pytest.mark.asyncio
async def test_handle_clerk_user_upsert_duplicate_email_renames_old_user(db_session):
    """
    Verifies that when Clerk sends a user.created event with a new Clerk ID
    for an email address that already belongs to an existing user in the database:
    1. The old user's email is updated to '[duplicate]<old_email>'.
    2. The old user's record remains safe in the database.
    3. The new user is created with the new Clerk ID and real email.
    """
    old_clerk_id = "user_clerk_old_111"
    new_clerk_id = "user_clerk_new_222"
    real_email = "test2@gmail.com"

    # Clean up any leftover test data
    db_session.query(User).filter(User.id.in_([old_clerk_id, new_clerk_id])).delete()
    db_session.query(User).filter(User.email.in_([real_email, f"[duplicate]{real_email}"])).delete()
    db_session.commit()

    # 1. Create original user record (simulating user created earlier in local DB)
    old_user = User(
        id=old_clerk_id,
        email=real_email,
        store_name="Test Store Old",
        status="approved"
    )
    db_session.add(old_user)
    db_session.commit()

    # 2. Simulate Clerk webhook user.created event for re-created user with new Clerk ID
    event_data = {
        "id": new_clerk_id,
        "email_addresses": [{"email_address": real_email}],
        "first_name": "Test",
        "last_name": "User"
    }

    new_user = handle_clerk_user_upsert(db_session, event_data)

    # 3. Assertions
    assert new_user.id == new_clerk_id
    assert new_user.email == real_email
    assert new_user.store_name == "Test User's Store"

    # Verify old user record stays safe with [duplicate] email prefix
    refreshed_old_user = db_session.query(User).filter(User.id == old_clerk_id).first()
    assert refreshed_old_user is not None
    assert refreshed_old_user.email == f"[duplicate]{real_email}"
    assert refreshed_old_user.store_name == "Test Store Old"

    # Clean up test data
    db_session.delete(new_user)
    db_session.delete(refreshed_old_user)
    db_session.commit()
