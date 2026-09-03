from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.system.models import CartItem
from app.core.logging_config import get_logger

cart_logger = get_logger("cart")

MAX_CART_ITEMS = 5
MAX_LINE_QUANTITY = 20

async def execute_add_to_cart(merchant_id: str, customer_email: str, args: dict, db: Session) -> dict:
    product_id = str(args.get("product_id", "")).strip()
    name = str(args.get("name", "")).strip()
    thumbnail_url = args.get("thumbnail_url")

    try:
        price = float(args.get("price", 0.0))
    except (TypeError, ValueError):
        price = 0.0

    try:
        quantity = int(args.get("quantity", 1))
    except (TypeError, ValueError):
        quantity = 1

    if not product_id or not name:
        cart_logger.warning(f"Cart add rejected (invalid data): customer={customer_email}")
        return {"error": "invalid_product_data", "message": "product_id and name are required."}

    if quantity < 1:
        cart_logger.warning(f"Cart add rejected (non-positive quantity): customer={customer_email}")
        return {"error": "quantity_must_be_positive"}

    existing = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email,
        CartItem.product_id == product_id
    ).first()

    if existing:
        new_quantity = existing.quantity + quantity
        if new_quantity > MAX_LINE_QUANTITY:
            cart_logger.warning(f"Cart add rejected (limit reached): product={product_id}, customer={customer_email}")
            return {"error": "max_line_quantity_exceeded", "message": f"Maximum quantity per item is {MAX_LINE_QUANTITY}."}
        existing.quantity = new_quantity
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        cart_logger.info(f"Item quantity updated in cart: product={product_id}, new_quantity={new_quantity}, customer={customer_email}")
        return {"status": "updated", "product_id": product_id, "quantity": new_quantity}

    current_count = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email
    ).count()

    if current_count >= MAX_CART_ITEMS:
        cart_logger.warning(f"Cart add rejected (cart full): customer={customer_email}")
        return {"error": "cart_full", "message": f"Cart is full (max {MAX_CART_ITEMS} items). Remove something before adding more."}

    if quantity > MAX_LINE_QUANTITY:
        cart_logger.warning(f"Cart add rejected (limit reached): product={product_id}, customer={customer_email}")
        return {"error": "max_line_quantity_exceeded", "message": f"Maximum quantity per item is {MAX_LINE_QUANTITY}."}

    new_item = CartItem(
        merchant_id=merchant_id,
        customer_email=customer_email,
        product_id=product_id,
        name=name,
        thumbnail_url=thumbnail_url,
        price=price,
        quantity=quantity
    )
    db.add(new_item)
    db.commit()
    cart_logger.info(f"Item added to cart: product={product_id}, quantity={quantity}, customer={customer_email}")
    return {"status": "added", "product_id": product_id, "quantity": quantity}


async def execute_get_cart_items(merchant_id: str, customer_email: str, db: Session) -> dict:
    rows = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email
    ).order_by(CartItem.created_at.asc()).all()

    items = [
        {
            "product_id": r.product_id,
            "name": r.name,
            "thumbnail_url": r.thumbnail_url,
            "price": float(r.price),
            "quantity": r.quantity,
        }
        for r in rows
    ]
    subtotal = sum(float(r.price) * r.quantity for r in rows)
    cart_logger.debug(f"Cart fetched: items={len(items)}, subtotal={subtotal}, customer={customer_email}")
    return {"items": items, "count": len(items), "subtotal": round(subtotal, 2)}


async def execute_update_cart_item(merchant_id: str, customer_email: str, args: dict, db: Session) -> dict:
    product_id = str(args.get("product_id", "")).strip()
    try:
        quantity = int(args.get("quantity", 0))
    except (TypeError, ValueError):
        quantity = 0

    existing = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email,
        CartItem.product_id == product_id
    ).first()

    if not existing:
        return {"error": "not_in_cart"}

    if quantity <= 0:
        db.delete(existing)
        db.commit()
        cart_logger.info(f"Item removed from cart via update (quantity 0): product={product_id}, customer={customer_email}")
        return {"status": "removed", "product_id": product_id}

    if quantity > MAX_LINE_QUANTITY:
        cart_logger.warning(f"Cart update rejected (limit reached): product={product_id}, customer={customer_email}")
        return {"error": "max_line_quantity_exceeded", "message": f"Maximum quantity per item is {MAX_LINE_QUANTITY}."}

    existing.quantity = quantity
    existing.updated_at = datetime.now(timezone.utc)
    db.commit()
    cart_logger.info(f"Cart item updated: product={product_id}, quantity={quantity}, customer={customer_email}")
    return {"status": "updated", "product_id": product_id, "quantity": quantity}


async def execute_remove_from_cart(merchant_id: str, customer_email: str, args: dict, db: Session) -> dict:
    product_id = str(args.get("product_id", "")).strip()

    existing = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email,
        CartItem.product_id == product_id
    ).first()

    if not existing:
        return {"error": "not_in_cart"}

    db.delete(existing)
    db.commit()
    cart_logger.info(f"Cart item removed: product={product_id}, customer={customer_email}")
    return {"status": "removed", "product_id": product_id}
