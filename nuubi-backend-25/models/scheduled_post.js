module.exports = (sequelize, DataTypes) => {
    const ScheduledPost = sequelize.define(
      "scheduled_posts",
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
  
        creator_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
  
        group_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
  
        title: {
          type: DataTypes.STRING(80),
          allowNull: false,
        },
  
        body_text: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        image_url: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          
          file_url: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          
          file_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
          },
  
        scheduled_date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
  
        scheduled_time: {
          type: DataTypes.STRING(5),
          allowNull: false,
        },
  
        timezone: {
          type: DataTypes.STRING(64),
          allowNull: false,
        },
  
        scheduled_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
  
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: "pending",
        },
  
        post_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
  
        published_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
  
        error_message: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
      },
      {
        tableName: "scheduled_posts",
        createdAt: "created_at",
        updatedAt: "updated_at",
      }
    );
  
    return ScheduledPost;
  };