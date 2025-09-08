"""
Authentication API routes
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
import structlog

from ...db.session import get_db
from ...core.security import create_access_token, verify_token
from ...schemas.auth import Token, UserLogin

logger = structlog.get_logger()
router = APIRouter()
security = HTTPBearer()


@router.post("/login", response_model=Token)
async def login(
    user_credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return access token
    """
    try:
        from ...db.models import User
        from ...core.security import verify_password

        user = db.query(User).filter(User.email == user_credentials.email).first()

        if not user or not verify_password(user_credentials.password, user.hashed_password):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = create_access_token(data={"sub": user.id})

        return Token(access_token=access_token, token_type="bearer")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login failed", error=str(e))
        raise HTTPException(status_code=500, detail="Login failed")


@router.post("/register")
async def register(
    user_credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Register new user
    """
    try:
        from ...db.models import User
        from ...core.security import get_password_hash

        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_credentials.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Create new user
        hashed_password = get_password_hash(user_credentials.password)
        new_user = User(
            email=user_credentials.email,
            hashed_password=hashed_password
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {"message": "User created successfully", "user_id": new_user.id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Registration failed", error=str(e))
        raise HTTPException(status_code=500, detail="Registration failed")


@router.get("/me")
async def read_users_me(current_user: str = Depends(verify_token)):
    """
    Get current user information
    """
    return {"user_id": current_user}
