import pytest
from app.system.models import User
from app.system.service import handle_clerk_user_upsert

def test_handle_clerk_user_upsert_creation(db_session):
    event_data = {
        "id": "user_3Ik7b9Hlr1lTjRLuBCIxvyYadDh",
        "first_name": "Vijay",
        "last_name": "Singh",
        "email_addresses": [
            {
                "email_address": "vijaysingh.handler@gmail.com"
            }
        ]
    }

    user = handle_clerk_user_upsert(db_session, event_data)
    assert user.id == "user_3Ik7b9Hlr1lTjRLuBCIxvyYadDh"
    assert user.email == "vijaysingh.handler@gmail.com"
    assert user.store_name == "Vijay Singh's Store"
    assert user.status == "approved"

def test_handle_clerk_user_upsert_update(db_session):
    event_data = {
        "id": "user_3Ik7b9Hlr1lTjRLuBCIxvyYadDh",
        "first_name": "Vijay",
        "last_name": "Singh",
        "email_addresses": [
            {
                "email_address": "updated.email@gmail.com"
            }
        ]
    }

    user = handle_clerk_user_upsert(db_session, event_data)
    assert user.email == "updated.email@gmail.com"
